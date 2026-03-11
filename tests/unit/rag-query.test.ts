/**
 * Level 5 — RAG Query Tests (Real Pinecone + Real Embeddings)
 *
 * Tests enhanced queryRAG with real Pinecone and OpenAI calls.
 * OPENAI_API_KEY + PINECONE_API_KEY required — fails immediately if missing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { MemoryManager } from "baseclaw-agent/src/memory/manager.js";

describe("Level 5 — RAG Query (enhanced queryRAG)", { timeout: 30_000 }, () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
        }
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY is required. Set it in .env to run tests.");
        }
    });

    it("queries RAG namespace and returns results", async () => {
        const mm = new MemoryManager("test-storage-tenant");
        const results = await mm.queryRAG("machine learning document", 5);

        // Results may be empty if no vectors exist yet, but should not throw
        expect(Array.isArray(results)).toBe(true);
    });

    it("queries with phase filter", async () => {
        const mm = new MemoryManager("test-storage-tenant");
        const results = await mm.queryRAG("test query", 5, { phase: "ideation" });
        expect(Array.isArray(results)).toBe(true);
    });

    it("queries with agent filter", async () => {
        const mm = new MemoryManager("test-storage-tenant");
        const results = await mm.queryRAG("query", 5, { agent: "planning" });
        expect(Array.isArray(results)).toBe(true);
    });

    it("queries with fileType filter", async () => {
        const mm = new MemoryManager("test-storage-tenant");
        const results = await mm.queryRAG("query", 5, { fileType: "pdf" });
        expect(Array.isArray(results)).toBe(true);
    });

    it("queries with multiple filters combined", async () => {
        const mm = new MemoryManager("test-storage-tenant");
        const results = await mm.queryRAG("query", 3, {
            phase: "planning",
            agent: "execution",
            fileType: "ts",
        });
        expect(Array.isArray(results)).toBe(true);
    });

    it("returns results with score and metadata when vectors exist", async () => {
        const mm = new MemoryManager("test-storage-tenant");
        const results = await mm.queryRAG("RAG storage verification", 5);

        // If vectors exist from rag-storage test, we should get results
        if (results.length > 0) {
            expect(results[0].score).toBeGreaterThan(0);
            expect(results[0].id).toBeTruthy();
            expect(results[0].metadata).toBeTruthy();
        }
    });
});
