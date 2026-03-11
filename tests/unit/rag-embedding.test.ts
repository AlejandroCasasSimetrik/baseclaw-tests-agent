/**
 * Level 5 — RAG Embedding Tests (Real OpenAI)
 *
 * Tests batch embedding with real OpenAI API calls.
 * OPENAI_API_KEY required — fails immediately if missing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { EMBEDDING_MODEL, EMBEDDING_BATCH_SIZE } from "baseclaw-agent/src/rag/config.js";
import { embedChunks, getEmbeddingModelName } from "baseclaw-agent/src/rag/embedding.js";
import type { RAGChunk, RAGChunkMetadata } from "baseclaw-agent/src/rag/types.js";

function makeChunk(text: string, index: number, total: number): RAGChunk {
    return {
        text,
        metadata: {
            source_file: "test.txt",
            file_type: "txt",
            upload_timestamp: "2026-01-01T00:00:00Z",
            active_phase: "ideation",
            active_agent: "conversation",
            chunk_index: String(index),
            chunk_total: String(total),
            tenant_id: "tenant-123",
        },
    };
}

describe("Level 5 — RAG Embedding", { timeout: 30_000 }, () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
        }
    });

    it("returns empty array for empty chunks", async () => {
        const result = await embedChunks([]);
        expect(result).toHaveLength(0);
    });

    it("embeds chunks and returns vectors with correct dimensions", async () => {
        const chunks = [
            makeChunk("Hello world, this is a test document.", 0, 2),
            makeChunk("Another paragraph for embedding.", 1, 2),
        ];

        const result = await embedChunks(chunks);
        expect(result).toHaveLength(2);
        expect(result[0].chunkIndex).toBe(0);
        expect(result[1].chunkIndex).toBe(1);

        // Real OpenAI text-embedding-3-small returns 1536-dim vectors
        expect(result[0].vector.length).toBe(1536);
        expect(result[1].vector.length).toBe(1536);

        // Vectors should be arrays of numbers
        expect(typeof result[0].vector[0]).toBe("number");
    });

    it("returns configured model name", () => {
        expect(getEmbeddingModelName()).toBe(EMBEDDING_MODEL);
    });

    describe("config defaults", () => {
        it("has a default embedding model", () => {
            expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
        });

        it("has a default batch size", () => {
            expect(EMBEDDING_BATCH_SIZE).toBe(100);
        });
    });
});
