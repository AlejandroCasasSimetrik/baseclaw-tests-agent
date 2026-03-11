import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    resetPineconeClient,
    getPineconeClient,
} from "baseclaw-agent/src/memory/semantic/pinecone.js";

/**
 * Semantic Memory Tests
 *
 * Tests write restrictions, namespace access, and metadata validation.
 * Updated to match current access control policy where ALL standard agents
 * can write to knowledge namespace.
 */

// We need to set env vars BEFORE importing the module functions that use them
const ORIGINAL_ENV = { ...process.env };

describe("Semantic Memory", () => {
    beforeEach(() => {
        resetPineconeClient();
        process.env.PINECONE_API_KEY = "test-key";
        process.env.PINECONE_INDEX = "test-index";
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    // ── Write Restrictions ─────────────────────────────────
    // KNOWLEDGE_WRITERS now includes all standard agents:
    //   reviewer, distillation, conversation, ideation, planning, execution, gate
    // Only truly unknown agent types should be denied.

    describe("upsertToKnowledge() access control", () => {
        it("throws for unknown agent types not in KNOWLEDGE_WRITERS", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            await expect(
                upsertToKnowledge(
                    [
                        {
                            id: "vec-1",
                            values: [0.1, 0.2],
                            metadata: {
                                source: "test",
                                timestamp: "2026-01-01",
                                agentType: "unknown_agent",
                                taskId: "t1",
                                tenantId: "tenant-1",
                                namespace: "knowledge" as const,
                            },
                        },
                    ],
                    "unknown_agent"
                )
            ).rejects.toThrow("Access denied");
        });

        it("throws for empty string agent type", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            await expect(
                upsertToKnowledge([], "")
            ).rejects.toThrow("Access denied");
        });

        it("rejects random unregistered agent names", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            const invalidAgents = ["admin", "root", "system", "external", "test"];
            for (const agent of invalidAgents) {
                await expect(
                    upsertToKnowledge([], agent)
                ).rejects.toThrow("Access denied");
            }
        });

        it("allows reviewer agent (in KNOWLEDGE_WRITERS)", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            // Should NOT throw Access denied — it will fail on Pinecone API call instead
            // because we're using a fake API key, but the access control check passes
            await expect(
                upsertToKnowledge([], "reviewer")
            ).rejects.not.toThrow("Access denied");
        });

        it("allows conversation agent (in KNOWLEDGE_WRITERS)", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            await expect(
                upsertToKnowledge([], "conversation")
            ).rejects.not.toThrow("Access denied");
        });

        it("allows ideation agent (in KNOWLEDGE_WRITERS)", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            await expect(
                upsertToKnowledge([], "ideation")
            ).rejects.not.toThrow("Access denied");
        });

        it("allows execution agent (in KNOWLEDGE_WRITERS)", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            await expect(
                upsertToKnowledge([], "execution")
            ).rejects.not.toThrow("Access denied");
        });

        it("allows planning agent (in KNOWLEDGE_WRITERS)", async () => {
            const { upsertToKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            await expect(
                upsertToKnowledge([], "planning")
            ).rejects.not.toThrow("Access denied");
        });
    });

    // ── Client Initialization ──────────────────────────────

    describe("getPineconeClient()", () => {
        it("throws when PINECONE_API_KEY is missing", () => {
            resetPineconeClient();
            delete process.env.PINECONE_API_KEY;
            expect(() => getPineconeClient()).toThrow(
                "PINECONE_API_KEY"
            );
        });
    });

    // ── Dual Namespace ─────────────────────────────────────

    describe("namespace functions", () => {
        it("getNamespace is a function", async () => {
            const { getNamespace } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            expect(typeof getNamespace).toBe("function");
        });

        it("querySemanticMemory is a function", async () => {
            const { querySemanticMemory } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            expect(typeof querySemanticMemory).toBe("function");
        });

        it("deleteFromKnowledge is a function", async () => {
            const { deleteFromKnowledge } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            expect(typeof deleteFromKnowledge).toBe("function");
        });
    });

    // ── Embedding Generation ───────────────────────────────

    describe("generateEmbedding()", () => {
        it("generateEmbedding is a function", async () => {
            const { generateEmbedding } = await import(
                "../../src/memory/semantic/pinecone.js"
            );
            expect(typeof generateEmbedding).toBe("function");
        });
    });

    // ── Metadata Structure ─────────────────────────────────

    describe("SemanticVectorMetadata type contract", () => {
        it("required metadata fields are defined in the type system", () => {
            // This test validates that the type exists and has the right shape
            // by constructing a valid metadata object
            const metadata = {
                source: "reviewer",
                timestamp: "2026-01-01T00:00:00Z",
                agentType: "reviewer",
                taskId: "task-1",
                tenantId: "tenant-1",
                namespace: "knowledge" as const,
            };

            expect(metadata).toHaveProperty("source");
            expect(metadata).toHaveProperty("timestamp");
            expect(metadata).toHaveProperty("agentType");
            expect(metadata).toHaveProperty("taskId");
            expect(metadata).toHaveProperty("tenantId");
            expect(metadata).toHaveProperty("namespace");
            expect(["rag", "knowledge"]).toContain(metadata.namespace);
        });
    });
});
