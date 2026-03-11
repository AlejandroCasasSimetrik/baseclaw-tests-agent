/**
 * Level 5 — RAG Storage Tests (Real Pinecone)
 *
 * Tests Pinecone RAG namespace upsert with real vectors.
 * OPENAI_API_KEY + PINECONE_API_KEY required — fails immediately if missing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { storeChunks } from "baseclaw-agent/src/rag/storage.js";
import { embedChunks } from "baseclaw-agent/src/rag/embedding.js";
import type { RAGChunk } from "baseclaw-agent/src/rag/types.js";

function makeChunk(text: string, index: number, total: number): RAGChunk {
    return {
        text,
        metadata: {
            source_file: "test-storage.pdf",
            file_type: "pdf",
            upload_timestamp: "2026-01-01T00:00:00Z",
            active_phase: "planning",
            active_agent: "planning",
            chunk_index: String(index),
            chunk_total: String(total),
            tenant_id: "test-storage-tenant",
        },
    };
}

describe("Level 5 — RAG Storage", { timeout: 30_000 }, () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
        }
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY is required. Set it in .env to run tests.");
        }
    });

    it("returns zero for empty input", async () => {
        const result = await storeChunks([], [], "test.pdf", "2026-01-01");
        expect(result.vectorCount).toBe(0);
    });

    it("upserts real vectors to Pinecone RAG namespace", async () => {
        const chunks = [
            makeChunk("This is a test document for RAG storage verification.", 0, 2),
            makeChunk("Second page with different content about machine learning.", 1, 2),
        ];

        // Get real embeddings
        const embeddings = await embedChunks(chunks);
        expect(embeddings).toHaveLength(2);

        // Store to real Pinecone
        const result = await storeChunks(chunks, embeddings, "test-storage.pdf", "2026-01-01T00:00:00Z");
        expect(result.vectorCount).toBe(2);
    });
});
