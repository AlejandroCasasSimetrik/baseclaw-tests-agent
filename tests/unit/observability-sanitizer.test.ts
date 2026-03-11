import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    sanitizeString,
    sanitizeTraceData,
    containsSensitiveData,
    getRedactedMarker,
} from "baseclaw-agent/src/observability/sanitizer.js";

const REDACTED = getRedactedMarker();

describe("Trace Sanitization (Level 4)", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Set known sensitive env vars for testing
        process.env.OPENAI_API_KEY = "sk-proj-TestKey123456789012345678901234567890";
        process.env.PINECONE_API_KEY = "pcsk_TestPinecone1234567890";
        process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    // ── API Key Patterns ────────────────────────────────────

    it("strips OpenAI API keys", () => {
        const input = "My key is sk-proj-KsdR3jVua68HTGCmUP_3Bj7qsjh7fWOX2WzjzSm9ROKwR85";
        const result = sanitizeString(input);
        expect(result).not.toContain("sk-proj-");
        expect(result).toContain(REDACTED);
    });

    it("strips Pinecone API keys", () => {
        const input = "Pinecone key: pcsk_2S9kj8_KzgEEv5bz8s7WMMBdfRsM9kf";
        const result = sanitizeString(input);
        expect(result).not.toContain("pcsk_");
        expect(result).toContain(REDACTED);
    });

    it("strips LangSmith API keys", () => {
        const input = "LangSmith: ls__abcdef1234567890key";
        const result = sanitizeString(input);
        expect(result).not.toContain("ls__");
        expect(result).toContain(REDACTED);
    });

    it("strips PostgreSQL connection strings", () => {
        const input = "Connect to postgresql://user:password@host:5432/mydb";
        const result = sanitizeString(input);
        expect(result).not.toContain("postgresql://");
        expect(result).toContain(REDACTED);
    });

    // ── PII Patterns ────────────────────────────────────────

    it("masks email addresses", () => {
        const input = "Contact john.doe@example.com for support";
        const result = sanitizeString(input);
        expect(result).not.toContain("john.doe@example.com");
        expect(result).toContain(REDACTED);
    });

    it("masks phone numbers", () => {
        const input = "Call 555-123-4567 or (555) 987-6543";
        const result = sanitizeString(input);
        expect(result).not.toContain("555-123-4567");
        expect(result).not.toContain("987-6543");
    });

    // ── .env Variable Stripping ─────────────────────────────

    it("strips known .env variable values", () => {
        const envKey = process.env.OPENAI_API_KEY!;
        const input = `The API key is ${envKey} and it works`;
        const result = sanitizeString(input);
        expect(result).not.toContain(envKey);
        expect(result).toContain(REDACTED);
    });

    it("strips DATABASE_URL values", () => {
        const dbUrl = process.env.DATABASE_URL!;
        const input = `Connecting to ${dbUrl}`;
        const result = sanitizeString(input);
        expect(result).not.toContain(dbUrl);
    });

    // ── Deep Object Sanitization ────────────────────────────

    it("deep-walks objects and sanitizes all strings", () => {
        const input = {
            config: {
                apiKey: "sk-proj-TestDeepWalk1234567890abcdefghijklmnop",
                nested: {
                    email: "secret@company.com",
                    safe: "hello world",
                },
            },
            list: ["sk-proj-Another1234567890abcdefghijklmnopqrst", "safe value"],
        };

        const result = sanitizeTraceData(input);
        expect(result.config.apiKey).toContain(REDACTED);
        expect(result.config.nested.email).toContain(REDACTED);
        expect(result.config.nested.safe).toBe("hello world");
        expect(result.list[0]).toContain(REDACTED);
        expect(result.list[1]).toBe("safe value");
    });

    it("does not mutate the original object", () => {
        const input = { key: "sk-proj-DoNotMutate1234567890abcdefghijklmnop" };
        const result = sanitizeTraceData(input);
        expect(input.key).toContain("sk-proj-");
        expect(result.key).toContain(REDACTED);
    });

    it("handles null and undefined", () => {
        expect(sanitizeTraceData(null)).toBeNull();
        expect(sanitizeTraceData(undefined)).toBeUndefined();
    });

    it("handles numbers and booleans unchanged", () => {
        expect(sanitizeTraceData(42)).toBe(42);
        expect(sanitizeTraceData(true)).toBe(true);
    });

    // ── containsSensitiveData ───────────────────────────────

    it("detects sensitive data in strings", () => {
        expect(containsSensitiveData("sk-proj-Test1234567890abcdefghijklm")).toBe(true);
        expect(containsSensitiveData("hello world")).toBe(false);
    });

    // ── End-to-End: Secrets through pipeline ────────────────

    it("verifies secrets do NOT appear in sanitized trace output", () => {
        const tracePayload = {
            agent_type: "conversation",
            task_id: "test-123",
            inputs: {
                message: "My API key is sk-proj-RealKeyHere1234567890abcdef and email is user@secret.com",
            },
            outputs: {
                response: "I processed your request using postgresql://admin:hunter2@db.internal:5432/prod",
            },
            metadata: {
                pinecone_key: "pcsk_realPineconeKey1234567890",
                langsmith_key: "ls__realLangSmithKey1234567890",
            },
        };

        const sanitized = sanitizeTraceData(tracePayload);
        const fullOutput = JSON.stringify(sanitized);

        // None of these patterns should appear in sanitized output
        expect(fullOutput).not.toContain("sk-proj-");
        expect(fullOutput).not.toContain("pcsk_");
        expect(fullOutput).not.toContain("ls__");
        expect(fullOutput).not.toContain("postgresql://");
        expect(fullOutput).not.toContain("user@secret.com");

        // Safe fields should remain
        expect(sanitized.agent_type).toBe("conversation");
        expect(sanitized.task_id).toBe("test-123");
    });
});
