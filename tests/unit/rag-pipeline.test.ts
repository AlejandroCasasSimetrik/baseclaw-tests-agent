/**
 * Level 5 — RAG Pipeline Tests (Real Services)
 *
 * Tests the end-to-end pipeline orchestrator with real:
 *   - File validation (pure logic)
 *   - Parsing (text extraction)
 *   - Chunking (recursive text)
 *   - Embedding (real OpenAI)
 *   - Storage (real Pinecone)
 *   - Notification (pure logic)
 *   - Episodic memory (real PostgreSQL)
 *
 * OPENAI_API_KEY + PINECONE_API_KEY + DATABASE_URL required.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runRAGPipeline, triggerRAGPipeline } from "baseclaw-agent/src/rag/pipeline.js";
import type { FileUploadContext } from "baseclaw-agent/src/rag/types.js";

describe("Level 5 — RAG Pipeline", { timeout: 60_000 }, () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
        }
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY is required. Set it in .env to run tests.");
        }
    });

    it("runs full pipeline on a valid text file", async () => {
        const context: FileUploadContext = {
            filename: "test-pipeline.txt",
            content: Buffer.from(
                "BaseClaw RAG Pipeline Integration Test.\n\n" +
                "This document verifies that the full pipeline works end-to-end.\n\n" +
                "It includes parsing, chunking, embedding, and storage.\n\n" +
                "All operations use real services — no mocks."
            ),
            sizeBytes: 200,
            activePhase: "ideation",
            activeAgent: "conversation",
            tenantId: "test-pipeline-tenant",
            episodeId: "test-episode-pipeline",
        };

        const result = await runRAGPipeline(context);

        expect(result.success).toBe(true);
        expect(result.filename).toBe("test-pipeline.txt");
        expect(result.chunkCount).toBeGreaterThanOrEqual(1);
        expect(result.chunkingStrategy).toBeTruthy();
        expect(result.traceId).toBeTruthy();
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.credentialWarnings).toHaveLength(0);
    });

    it("rejects files exceeding size limit", async () => {
        const context: FileUploadContext = {
            filename: "huge-file.pdf",
            content: Buffer.alloc(1), // Tiny content but sizeBytes is huge
            sizeBytes: 200 * 1024 * 1024, // 200MB
            activePhase: "ideation",
            activeAgent: "conversation",
            tenantId: "test-pipeline-tenant",
            episodeId: "test-episode-big",
        };

        const result = await runRAGPipeline(context);

        expect(result.success).toBe(false);
        expect(result.rejectionReason).toContain("exceeds");
        expect(result.chunkCount).toBe(0);
    });

    it("rejects unsupported file types", async () => {
        const context: FileUploadContext = {
            filename: "malware.exe",
            content: Buffer.from("bad"),
            sizeBytes: 100,
            activePhase: "ideation",
            activeAgent: "conversation",
            tenantId: "test-pipeline-tenant",
            episodeId: "test-episode-exe",
        };

        const result = await runRAGPipeline(context);

        expect(result.success).toBe(false);
        expect(result.rejectionReason).toContain("not supported");
    });

    it("detects credentials in content without blocking", async () => {
        const context: FileUploadContext = {
            filename: "config-with-keys.txt",
            content: Buffer.from(
                "Normal content here.\napi_key=sk-proj-FakeKey123456789012345678901234567890\nMore text."
            ),
            sizeBytes: 100,
            activePhase: "ideation",
            activeAgent: "conversation",
            tenantId: "test-pipeline-tenant",
            episodeId: "test-episode-creds",
        };

        const result = await runRAGPipeline(context);

        expect(result.success).toBe(true);
        expect(result.credentialWarnings.length).toBeGreaterThan(0);
    });

    it("triggerRAGPipeline does not throw on errors", () => {
        const context: FileUploadContext = {
            filename: "bad.xyz_unsupported",
            content: Buffer.from("test"),
            sizeBytes: 100,
            activePhase: "ideation",
            activeAgent: "conversation",
            tenantId: "test-pipeline-tenant",
            episodeId: "test-episode-trigger",
        };

        // Fire-and-forget — should not throw
        expect(() => triggerRAGPipeline(context)).not.toThrow();
    });
});
