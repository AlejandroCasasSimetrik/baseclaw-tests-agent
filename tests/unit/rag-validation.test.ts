/**
 * Level 5 — RAG Validation Tests
 *
 * Tests file size rejection, type allowlist enforcement,
 * and credential scanning behavior.
 */

import { describe, it, expect } from "vitest";
import { validateFile, scanForCredentials } from "baseclaw-agent/src/rag/validation.js";
import { MAX_FILE_SIZE_BYTES } from "baseclaw-agent/src/rag/config.js";


describe("Level 5 — RAG Validation", () => {
    describe("scanForCredentials", () => {
        it("detects OpenAI API keys", () => {
            const warnings = scanForCredentials("here is my key: sk-proj-FakeKey123456789012345678901234567890");
            expect(warnings).toContain("OpenAI API Key");
        });

        it("detects Pinecone API keys", () => {
            const warnings = scanForCredentials("pinecone key: pcsk_abc123def456ghi789jkl");
            expect(warnings).toContain("Pinecone API Key");
        });

        it("detects LangSmith API keys", () => {
            const warnings = scanForCredentials("langsmith: lsv2_abc123def456ghi789");
            expect(warnings).toContain("LangSmith API Key");
        });

        it("detects AWS access keys", () => {
            const warnings = scanForCredentials("AKIAIOSFODNN7EXAMPLE");
            expect(warnings).toContain("AWS Access Key");
        });

        it("detects GitHub PATs", () => {
            const warnings = scanForCredentials("token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl");
            expect(warnings).toContain("GitHub Personal Access Token");
        });

        it("detects database connection strings", () => {
            const warnings = scanForCredentials("DATABASE_URL=postgresql://user:pass@host:5432/db");
            expect(warnings).toContain("Database Connection String");
        });

        it("detects generic credential patterns", () => {
            const warnings = scanForCredentials("api_key=supersecretvalue1234567890");
            expect(warnings).toContain("Generic Credential");
        });

        it("returns empty array for clean content", () => {
            const warnings = scanForCredentials("This is a clean document about TypeScript.");
            expect(warnings).toHaveLength(0);
        });
    });

    describe("validateFile", () => {
        it("rejects files exceeding size limit", async () => {
            const result = await validateFile(
                "huge-file.pdf",
                MAX_FILE_SIZE_BYTES + 1,
                Buffer.from("x")
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toContain("exceeds maximum");
        });

        it("accepts files within size limit", async () => {
            const result = await validateFile(
                "normal.pdf",
                1024,
                Buffer.from("normal content")
            );
            expect(result.valid).toBe(true);
        });

        it("rejects files with no extension", async () => {
            const result = await validateFile(
                "README",
                100,
                Buffer.from("test")
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toContain("no extension");
        });

        it("rejects unsupported file types", async () => {
            const result = await validateFile(
                "malware.exe",
                1024,
                Buffer.from("test")
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toContain("not supported");
        });

        it("accepts all supported document types", async () => {
            const types = ["pdf", "docx", "pptx", "xlsx", "txt", "md", "csv"];
            for (const ext of types) {
                const result = await validateFile(
                    `file.${ext}`,
                    100,
                    Buffer.from("content")
                );
                expect(result.valid).toBe(true);
            }
        });

        it("accepts all supported code types", async () => {
            const types = ["js", "ts", "py", "java", "go", "rs", "rb", "php"];
            for (const ext of types) {
                const result = await validateFile(
                    `file.${ext}`,
                    100,
                    Buffer.from("code")
                );
                expect(result.valid).toBe(true);
            }
        });

        it("accepts web file types", async () => {
            const types = ["html", "xml", "json", "yaml", "yml"];
            for (const ext of types) {
                const result = await validateFile(
                    `file.${ext}`,
                    100,
                    Buffer.from("content")
                );
                expect(result.valid).toBe(true);
            }
        });

        it("accepts media file types", async () => {
            const types = ["png", "jpg", "mp3", "wav", "mp4"];
            for (const ext of types) {
                const result = await validateFile(
                    `file.${ext}`,
                    100,
                    Buffer.from("binary")
                );
                expect(result.valid).toBe(true);
            }
        });

        it("flags credentials in content without rejecting", async () => {
            const result = await validateFile(
                "config.txt",
                100,
                Buffer.from("api_key=sk-proj-FakeKey123456789012345678901234567890")
            );
            expect(result.valid).toBe(true);
            expect(result.credentialWarnings.length).toBeGreaterThan(0);
        });

        it("returns empty warnings for clean content", async () => {
            const result = await validateFile(
                "clean.txt",
                100,
                Buffer.from("Just a normal text file")
            );
            expect(result.valid).toBe(true);
            expect(result.credentialWarnings).toHaveLength(0);
        });
    });
});
