/**
 * Memory Manager & Lifecycle Tests (Real Services)
 *
 * Tests the MemoryManager orchestrator with real:
 *   - PostgreSQL (episodic memory)
 *   - Pinecone (semantic memory)
 *   - OpenAI (embeddings)
 *
 * DATABASE_URL + PINECONE_API_KEY + OPENAI_API_KEY required.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { MemoryManager } from "baseclaw-agent/src/memory/manager.js";

describe("MemoryManager", { timeout: 30_000 }, () => {
    let manager: MemoryManager;

    beforeAll(() => {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL is required. Set it in .env to run tests.");
        }
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY is required. Set it in .env to run tests.");
        }
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
        }

        manager = new MemoryManager("00000000-0000-0000-0000-000000000098");
    });

    // ── Instantiation ──────────────────────────────────────

    describe("constructor", () => {
        it("creates a MemoryManager with tenantId", () => {
            expect(manager.tenantId).toBe("00000000-0000-0000-0000-000000000098");
        });

        it("throws if tenantId is empty", () => {
            expect(() => new MemoryManager("")).toThrow(
                "non-empty tenantId"
            );
        });
    });

    // ── loadContext ─────────────────────────────────────────

    describe("loadContext()", () => {
        it("returns a populated WorkingMemoryState", async () => {
            const wm = await manager.loadContext({
                taskId: "ctx-task-1",
                tenantId: "00000000-0000-0000-0000-000000000098",
                taskDescription: "Build a feature",
                agentType: "ideation",
            });

            expect(wm).toBeDefined();
            expect(wm.taskId).toBe("ctx-task-1");
            expect(wm.tenantId).toBe("00000000-0000-0000-0000-000000000098");
            expect(wm.taskDescription).toBe("Build a feature");
            expect(wm.currentGoal).toBe("Build a feature");
        });

        it("returns ragResults (may be empty if no prior data)", async () => {
            const wm = await manager.loadContext({
                taskId: "ctx-task-2",
                tenantId: "00000000-0000-0000-0000-000000000098",
                taskDescription: "Research topic",
                agentType: "ideation",
            });

            expect(Array.isArray(wm.ragResults)).toBe(true);
        });
    });

    // ── recordEpisode ──────────────────────────────────────

    describe("recordEpisode()", () => {
        it("returns a real EpisodeRecord from PostgreSQL", async () => {
            const record = await manager.recordEpisode({
                agentType: "ideation",
                taskDescription: "Memory manager test episode",
                outcome: "Success",
                durationMs: 1000,
                langsmithTraceId: "trace-mm-test-123",
            });

            expect(record).toBeDefined();
            expect(record.id).toBeTruthy();
            expect(record.tenantId).toBe("00000000-0000-0000-0000-000000000098");
            expect(record.agentType).toBe("ideation");
            expect(record.langsmithTraceId).toBe("trace-mm-test-123");
        });
    });

    // ── writeKnowledge ─────────────────────────────────────

    describe("writeKnowledge()", () => {
        it("writes knowledge to real Pinecone", async () => {
            await expect(
                manager.writeKnowledge(
                    "Validated insight from memory manager test",
                    {
                        source: "reviewer",
                        timestamp: new Date().toISOString(),
                        agentType: "reviewer",
                        taskId: "mm-t1",
                    },
                    "reviewer"
                )
            ).resolves.not.toThrow();
        });
    });

    // ── queryKnowledge ─────────────────────────────────────

    describe("queryKnowledge()", () => {
        it("returns MemoryQueryResult array from real Pinecone", async () => {
            const results = await manager.queryKnowledge("test query");
            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ── queryRAG ───────────────────────────────────────────

    describe("queryRAG()", () => {
        it("returns MemoryQueryResult array from real RAG namespace", async () => {
            const results = await manager.queryRAG("test query");
            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ── Episodic Read Delegations ──────────────────────────

    describe("episodic read delegations", () => {
        it("getRecentEpisodes returns real data", async () => {
            const results = await manager.getRecentEpisodes();
            expect(Array.isArray(results)).toBe(true);
        });

        it("getEpisodesByAgent returns real data", async () => {
            const results = await manager.getEpisodesByAgent("ideation");
            expect(Array.isArray(results)).toBe(true);
        });

        it("searchEpisodes returns real data", async () => {
            const results = await manager.searchEpisodes("test");
            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ── Full Lifecycle ─────────────────────────────────────

    describe("full memory lifecycle", () => {
        it("loadContext → simulate execution → recordEpisode", async () => {
            // Step 1: Load context
            const wm = await manager.loadContext({
                taskId: "lifecycle-task-mm",
                tenantId: "00000000-0000-0000-0000-000000000098",
                taskDescription: "Full lifecycle test",
                agentType: "execution",
            });

            expect(wm.taskId).toBe("lifecycle-task-mm");
            expect(wm.currentGoal).toBe("Full lifecycle test");

            // Step 2: Record episode
            const episode = await manager.recordEpisode({
                agentType: "execution",
                taskDescription: "Full lifecycle test",
                outcome: "Lifecycle completed successfully",
                durationMs: 5000,
                langsmithTraceId: "trace-lifecycle-mm",
            });

            expect(episode.id).toBeTruthy();
            expect(episode.tenantId).toBe("00000000-0000-0000-0000-000000000098");
            expect(episode.taskDescription).toBe("Full lifecycle test");
            expect(episode.outcome).toBe("Lifecycle completed successfully");
        });
    });
});
