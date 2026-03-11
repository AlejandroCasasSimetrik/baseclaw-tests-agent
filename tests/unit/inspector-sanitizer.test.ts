import { describe, it, expect } from "vitest";
import {
    sanitizeUrl,
    sanitizeMCPConfig,
    sanitizeString,
    sanitizeObject,
    sanitizeToolCallInput,
    summarizeToolOutput,
} from "baseclaw-agent/src/inspector/sanitizer.js";
import type { MCPServerConfig } from "baseclaw-agent/src/mcp/types.js";

describe("Inspector Sanitizer", () => {
    // ── sanitizeUrl ────────────────────────────────────────

    describe("sanitizeUrl()", () => {
        it("masks username and password in URLs", () => {
            const url = "http://admin:supersecret@host:5432/db";
            const result = sanitizeUrl(url);
            expect(result).not.toContain("admin");
            expect(result).not.toContain("supersecret");
            expect(result).toContain("***");
            expect(result).toContain("host:5432");
        });

        it("masks secret query parameters", () => {
            const url = "http://example.com/api?key=sk-secret123&name=test";
            const result = sanitizeUrl(url);
            expect(result).not.toContain("sk-secret123");
            expect(result).toContain("key=***");
        });

        it("passes through clean URLs unchanged", () => {
            const url = "http://localhost:8080/mcp";
            expect(sanitizeUrl(url)).toBe("http://localhost:8080/mcp");
        });

        it("handles malformed URLs gracefully", () => {
            const url = "not-a-url://user:pass@host";
            const result = sanitizeUrl(url);
            expect(result).not.toContain("pass");
        });
    });

    // ── sanitizeMCPConfig ──────────────────────────────────

    describe("sanitizeMCPConfig()", () => {
        const baseConfig: MCPServerConfig = {
            id: "test-server",
            name: "Test MCP",
            url: "http://localhost:8080/mcp",
            transport: "sse",
            agentTypes: ["execution"],
            description: "A test server",
            authConfig: { apiKey: "OPENAI_API_KEY", token: "GITHUB_TOKEN" },
            destructiveTools: ["write_file"],
        };

        it("returns id, name, transport, description", () => {
            const result = sanitizeMCPConfig(baseConfig);
            expect(result.id).toBe("test-server");
            expect(result.name).toBe("Test MCP");
            expect(result.transport).toBe("sse");
            expect(result.description).toBe("A test server");
        });

        it("shows credential env var NAMES but not values", () => {
            const result = sanitizeMCPConfig(baseConfig);
            expect(result.credentialVars).toEqual(["apiKey", "token"]);
            // Should NOT contain actual env var values
            expect(JSON.stringify(result)).not.toContain(process.env.OPENAI_API_KEY || "never");
        });

        it("does NOT expose authConfig values", () => {
            const result = sanitizeMCPConfig(baseConfig);
            expect(result).not.toHaveProperty("authConfig");
        });

        it("sanitizes URL credentials", () => {
            const configWithCreds: MCPServerConfig = {
                ...baseConfig,
                url: "http://user:pass@host:5432/db",
            };
            const result = sanitizeMCPConfig(configWithCreds);
            expect(result.url).not.toContain("pass");
        });
    });

    // ── sanitizeString ─────────────────────────────────────

    describe("sanitizeString()", () => {
        it("redacts OpenAI API keys", () => {
            const text = "Using key sk-abcdef12345678901234567890123456789012345678";
            expect(sanitizeString(text)).toContain("[REDACTED]");
            expect(sanitizeString(text)).not.toContain("sk-abcdef");
        });

        it("redacts LangSmith keys", () => {
            const text = "Config: ls__abcdef12345678901234567890";
            expect(sanitizeString(text)).toContain("[REDACTED]");
        });

        it("redacts GitHub PATs", () => {
            const text = "Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890";
            expect(sanitizeString(text)).toContain("[REDACTED]");
        });

        it("redacts Bearer tokens", () => {
            const text = "Authorization: Bearer eyJhb.cdef.ghij";
            expect(sanitizeString(text)).toContain("[REDACTED]");
        });

        it("leaves normal text unchanged", () => {
            const text = "Hello world, this is a normal message";
            expect(sanitizeString(text)).toBe(text);
        });
    });

    // ── sanitizeObject ─────────────────────────────────────

    describe("sanitizeObject()", () => {
        it("redacts known secret field names", () => {
            const obj = {
                name: "test",
                password: "super-secret",
                apiKey: "sk-1234",
                token: "ghp_xyz",
            };
            const result = sanitizeObject(obj) as any;
            expect(result.name).toBe("test");
            expect(result.password).toBe("[REDACTED]");
            expect(result.apiKey).toBe("[REDACTED]");
            expect(result.token).toBe("[REDACTED]");
        });

        it("handles nested objects", () => {
            const obj = { outer: { inner: { secret: "value" } } };
            const result = sanitizeObject(obj) as any;
            expect(result.outer.inner.secret).toBe("[REDACTED]");
        });

        it("handles arrays", () => {
            const arr = ["normal", { password: "secret" }];
            const result = sanitizeObject(arr) as any[];
            expect(result[0]).toBe("normal");
            expect(result[1].password).toBe("[REDACTED]");
        });

        it("handles null and undefined", () => {
            expect(sanitizeObject(null)).toBeNull();
            expect(sanitizeObject(undefined)).toBeUndefined();
        });

        it("handles numbers and booleans", () => {
            expect(sanitizeObject(42)).toBe(42);
            expect(sanitizeObject(true)).toBe(true);
        });
    });

    // ── sanitizeToolCallInput ───────────────────────────────

    describe("sanitizeToolCallInput()", () => {
        it("truncates long string values", () => {
            // Use a string that won't match secret patterns (spaces break base64 matching)
            const longString = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
            const result = sanitizeToolCallInput({ content: longString }, 100);
            expect((result.content as string).length).toBeLessThanOrEqual(101); // 100 + ellipsis
            expect((result.content as string)).toContain("…");
        });

        it("redacts secrets in values", () => {
            const result = sanitizeToolCallInput({
                key: "sk-abcdef12345678901234567890123456789012345678",
            });
            expect(result.key).toContain("[REDACTED]");
        });
    });

    // ── summarizeToolOutput ─────────────────────────────────

    describe("summarizeToolOutput()", () => {
        it("returns '(no output)' for null/undefined", () => {
            expect(summarizeToolOutput(null)).toBe("(no output)");
            expect(summarizeToolOutput(undefined)).toBe("(no output)");
        });

        it("truncates long output", () => {
            // Use a string that won't match secret patterns
            const long = Array.from({ length: 200 }, (_, i) => `item${i}`).join(" ");
            const result = summarizeToolOutput(long, 100);
            expect(result.length).toBeLessThanOrEqual(101);
            expect(result).toContain("…");
        });

        it("stringifies objects", () => {
            const result = summarizeToolOutput({ key: "value" });
            expect(result).toContain("key");
            expect(result).toContain("value");
        });

        it("redacts secrets in output", () => {
            const result = summarizeToolOutput(
                "Token: sk-abcdef12345678901234567890123456789012345678"
            );
            expect(result).toContain("[REDACTED]");
        });
    });
});
