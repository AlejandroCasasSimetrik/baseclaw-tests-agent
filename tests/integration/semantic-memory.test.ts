import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    getPineconeClient,
    resetPineconeClient,
    getIndex,
    getNamespace,
    upsertToKnowledge,
    querySemanticMemory,
    deleteFromKnowledge,
    generateEmbedding,
} from "baseclaw-agent/src/memory/semantic/pinecone.js";

/**
 * Semantic Memory — Live Integration Tests
 *
 * Runs against the live Pinecone `baseclaw-test` index.
 * Requires: PINECONE_API_KEY and PINECONE_INDEX env vars.
 *
 * Tests use a test-specific namespace prefix and clean up after themselves.
 * Note: Pinecone upserts are eventually consistent — we add small delays
 * where needed to let vectors become queryable.
 */

const TEST_VECTOR_ID = `test-vec-${Date.now()}`;
const WAIT_FOR_CONSISTENCY_MS = 3000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Semantic Memory (live Pinecone)", () => {
    beforeAll(() => {
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY required for integration tests");
        }
        if (!process.env.PINECONE_INDEX) {
            throw new Error("PINECONE_INDEX required for integration tests");
        }
        resetPineconeClient();
    });

    afterAll(async () => {
        // Clean up test vectors
        try {
            await deleteFromKnowledge(TEST_VECTOR_ID);
        } catch {
            // Ignore cleanup errors
        }
        resetPineconeClient();
    });

    // ── Client Connection ──────────────────────────────────

    describe("Pinecone client connection", () => {
        it("connects to Pinecone successfully", () => {
            const client = getPineconeClient();
            expect(client).toBeDefined();
        });

        it("gets an index handle", () => {
            const index = getIndex();
            expect(index).toBeDefined();
        });

        it("gets the baseclaw-test index by name", () => {
            const index = getIndex("baseclaw-test");
            expect(index).toBeDefined();
        });

        it("gets a knowledge namespace handle", () => {
            const ns = getNamespace("knowledge");
            expect(ns).toBeDefined();
        });

        it("gets a rag namespace handle", () => {
            const ns = getNamespace("rag");
            expect(ns).toBeDefined();
        });

        it("can describe index stats", async () => {
            const index = getIndex();
            const stats = await index.describeIndexStats();

            expect(stats).toBeDefined();
            expect(stats.dimension).toBe(1536);
            expect(typeof stats.totalRecordCount).toBe("number");
        });
    });

    // ── Embedding Generation ───────────────────────────────

    describe("generateEmbedding() — live OpenAI", () => {
        it("generates a 1536-dimension embedding vector", async () => {
            const embedding = await generateEmbedding(
                "The agent completed the task successfully"
            );

            expect(Array.isArray(embedding)).toBe(true);
            expect(embedding.length).toBe(1536);
            // Each value should be a number
            expect(typeof embedding[0]).toBe("number");
            // Embeddings should not be all zeros
            expect(embedding.some((v) => v !== 0)).toBe(true);
        });

        it("generates different embeddings for different texts", async () => {
            const [emb1, emb2] = await Promise.all([
                generateEmbedding("How to build a REST API"),
                generateEmbedding("Recipe for chocolate cake"),
            ]);

            // They should be different vectors
            const isDifferent = emb1.some((v, i) => v !== emb2[i]);
            expect(isDifferent).toBe(true);
        });
    });

    // ── Write Access Control ───────────────────────────────

    describe("upsertToKnowledge() — access control", () => {
        it("rejects writes from unauthorized agents", async () => {
            const testVectors = [
                {
                    id: "unauthorized-test",
                    values: new Array(1536).fill(0.01),
                    metadata: {
                        source: "test",
                        timestamp: new Date().toISOString(),
                        agentType: "unknown_rogue",
                        taskId: "test-task",
                        tenantId: "test-tenant",
                        namespace: "knowledge" as const,
                    },
                },
            ];

            // Truly unknown agent types should be denied
            await expect(
                upsertToKnowledge(testVectors, "unknown_rogue")
            ).rejects.toThrow("Access denied");

            await expect(
                upsertToKnowledge(testVectors, "admin")
            ).rejects.toThrow("Access denied");

            await expect(
                upsertToKnowledge(testVectors, "")
            ).rejects.toThrow("Access denied");
        });

        it("allows writes from all standard agents", async () => {
            const embedding = await generateEmbedding(
                "Integration test: all standard agents can write to knowledge"
            );

            // All standard agents are now in KNOWLEDGE_WRITERS
            const allowedAgents = ["ideation", "conversation", "planning", "execution"];
            for (const agent of allowedAgents) {
                const vecId = `test-allowed-${agent}-${Date.now()}`;
                await expect(
                    upsertToKnowledge(
                        [
                            {
                                id: vecId,
                                values: embedding,
                                metadata: {
                                    source: "access-test",
                                    timestamp: new Date().toISOString(),
                                    agentType: agent,
                                    taskId: "test-access",
                                    tenantId: "test-tenant-integ",
                                    namespace: "knowledge",
                                },
                            },
                        ],
                        agent
                    )
                ).resolves.not.toThrow();
                // Clean up
                try { await deleteFromKnowledge(vecId); } catch { /* ignore */ }
            }
        });

        it("allows writes from reviewer agent", async () => {
            const embedding = await generateEmbedding(
                "Integration test knowledge: always validate inputs before processing"
            );

            await expect(
                upsertToKnowledge(
                    [
                        {
                            id: TEST_VECTOR_ID,
                            values: embedding,
                            metadata: {
                                source: "integration-test",
                                timestamp: new Date().toISOString(),
                                agentType: "reviewer",
                                taskId: "test-task-001",
                                tenantId: "test-tenant-integ",
                                namespace: "knowledge",
                            },
                        },
                    ],
                    "reviewer"
                )
            ).resolves.not.toThrow();
        });

        it("allows writes from distillation process", async () => {
            const embedding = await generateEmbedding(
                "Distilled pattern: agents perform better with structured prompts"
            );

            const distillVecId = `test-distill-${Date.now()}`;

            await expect(
                upsertToKnowledge(
                    [
                        {
                            id: distillVecId,
                            values: embedding,
                            metadata: {
                                source: "integration-test-distill",
                                timestamp: new Date().toISOString(),
                                agentType: "reviewer",
                                taskId: "test-task-002",
                                tenantId: "test-tenant-integ",
                                namespace: "knowledge",
                            },
                        },
                    ],
                    "distillation"
                )
            ).resolves.not.toThrow();

            // Clean up
            try {
                await deleteFromKnowledge(distillVecId);
            } catch {
                // ignore
            }
        });
    });

    // ── Query Operations ───────────────────────────────────

    describe("querySemanticMemory() — live query", () => {
        it("queries the knowledge namespace and returns results", async () => {
            // Wait for eventual consistency after the upsert above
            await sleep(WAIT_FOR_CONSISTENCY_MS);

            const queryEmbed = await generateEmbedding(
                "validate inputs before processing"
            );

            const results = await querySemanticMemory(
                queryEmbed,
                "knowledge",
                5
            );

            expect(Array.isArray(results)).toBe(true);
            // Should find our test vector
            expect(results.length).toBeGreaterThanOrEqual(1);
            expect(results[0]).toHaveProperty("id");
            expect(results[0]).toHaveProperty("score");
            expect(results[0]).toHaveProperty("metadata");
            // Score should be between 0 and 1
            expect(results[0].score).toBeGreaterThan(0);
            expect(results[0].score).toBeLessThanOrEqual(1);
        });

        it("returns results with correct metadata shape", async () => {
            const queryEmbed = await generateEmbedding("validate inputs");

            const results = await querySemanticMemory(
                queryEmbed,
                "knowledge",
                1
            );

            if (results.length > 0) {
                const meta = results[0].metadata;
                expect(meta).toHaveProperty("source");
                expect(meta).toHaveProperty("timestamp");
                expect(meta).toHaveProperty("agentType");
                expect(meta).toHaveProperty("taskId");
                expect(meta).toHaveProperty("tenantId");
                expect(meta).toHaveProperty("namespace");
            }
        });

        it("filters by tenantId when provided", async () => {
            const queryEmbed = await generateEmbedding("validate inputs");

            const results = await querySemanticMemory(
                queryEmbed,
                "knowledge",
                5,
                "test-tenant-integ"
            );

            // All results should belong to the specified tenant
            for (const r of results) {
                expect(r.metadata.tenantId).toBe("test-tenant-integ");
            }
        });

        it("queries the rag namespace (may be empty)", async () => {
            const queryEmbed = await generateEmbedding("test query for rag");

            const results = await querySemanticMemory(
                queryEmbed,
                "rag",
                5
            );

            expect(Array.isArray(results)).toBe(true);
            // RAG namespace may be empty — that's fine
        });
    });

    // ── Delete Operations ──────────────────────────────────

    describe("deleteFromKnowledge()", () => {
        it("deletes a vector from the knowledge namespace", async () => {
            // Create a vector to delete
            const deletableId = `test-delete-${Date.now()}`;
            const embedding = await generateEmbedding("temporary test vector for deletion");

            await upsertToKnowledge(
                [
                    {
                        id: deletableId,
                        values: embedding,
                        metadata: {
                            source: "delete-test",
                            timestamp: new Date().toISOString(),
                            agentType: "reviewer",
                            taskId: "delete-test",
                            tenantId: "test-tenant-integ",
                            namespace: "knowledge",
                        },
                    },
                ],
                "reviewer"
            );

            // Delete it
            await expect(
                deleteFromKnowledge(deletableId)
            ).resolves.not.toThrow();
        });
    });

    // ── Dynamic Index Names ────────────────────────────────

    describe("dynamic index names (per-agent)", () => {
        it("getIndex() with custom name returns a handle", () => {
            // This just gets a handle — doesn't verify the index exists
            const index = getIndex("baseclaw-test");
            expect(index).toBeDefined();
        });

        it("getNamespace() with custom index name returns a handle", () => {
            const ns = getNamespace("knowledge", "baseclaw-test");
            expect(ns).toBeDefined();
        });

        it("default index uses PINECONE_INDEX env var", async () => {
            const index = getIndex();
            const stats = await index.describeIndexStats();
            expect(stats.dimension).toBe(1536);
        });
    });
});
