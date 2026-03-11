import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MemoryManager } from "baseclaw-agent/src/memory/manager.js";
import {
    createWorkingMemory,
    updateWorkingMemory,
    estimateTokens,
    enforceTokenBudget,
    clearWorkingMemory,
} from "baseclaw-agent/src/memory/working-memory.js";
import { resetDb } from "baseclaw-agent/src/memory/episodic/db.js";
import { resetPineconeClient } from "baseclaw-agent/src/memory/semantic/pinecone.js";

/**
 * Memory Lifecycle — Live Integration Tests
 *
 * End-to-end test of the full memory lifecycle:
 *   1. Create Working Memory for a task
 *   2. Load context from Episodic + Semantic memory
 *   3. Simulate agent execution with WM updates
 *   4. Record completed episode to PostgreSQL
 *   5. Verify the episode persists
 *   6. Clear working memory
 *
 * Requires: DATABASE_URL, PINECONE_API_KEY, PINECONE_INDEX, OPENAI_API_KEY
 */

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000002";

describe("Memory Lifecycle (end-to-end)", () => {
    let manager: MemoryManager;

    beforeAll(() => {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL required for integration tests");
        }
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY required for integration tests");
        }
        manager = new MemoryManager(TEST_TENANT_ID);
    });

    afterAll(() => {
        resetDb();
        resetPineconeClient();
    });

    // ── Phase 1: Working Memory Creation ───────────────────

    describe("Phase 1: Working Memory creation", () => {
        it("creates a fresh Working Memory for a new task", () => {
            const wm = createWorkingMemory(
                "lifecycle-task-001",
                TEST_TENANT_ID,
                "Build a REST API for user management"
            );

            expect(wm.taskId).toBe("lifecycle-task-001");
            expect(wm.tenantId).toBe(TEST_TENANT_ID);
            expect(wm.taskDescription).toBe("Build a REST API for user management");
            expect(wm.currentGoal).toBe("");
            expect(wm.activePlanSteps).toEqual([]);
            expect(wm.recentToolResults).toEqual([]);
            expect(wm.currentTokenEstimate).toBe(0);
        });
    });

    // ── Phase 2: Context Loading ───────────────────────────

    describe("Phase 2: Context loading via MemoryManager", () => {
        it("loads context by querying Episodic and Semantic memory", async () => {
            const wm = await manager.loadContext({
                taskId: "lifecycle-task-002",
                tenantId: TEST_TENANT_ID,
                taskDescription: "Design a database schema for e-commerce",
                agentType: "planning",
            });

            expect(wm).toBeDefined();
            expect(wm.taskId).toBe("lifecycle-task-002");
            expect(wm.tenantId).toBe(TEST_TENANT_ID);
            expect(wm.currentGoal).toBe("Design a database schema for e-commerce");
            // ragResults may contain context from past episodes and/or semantic knowledge
            expect(Array.isArray(wm.ragResults)).toBe(true);
        });
    });

    // ── Phase 3: Working Memory Updates (simulated agent execution) ────

    describe("Phase 3: Agent execution (Working Memory updates)", () => {
        it("updates Working Memory with plan steps", () => {
            let wm = createWorkingMemory(
                "lifecycle-task-003",
                TEST_TENANT_ID,
                "Implement authentication system"
            );

            wm = updateWorkingMemory(wm, {
                currentGoal: "Implement JWT-based authentication",
                activePlanSteps: [
                    { id: "step-1", description: "Set up auth middleware", status: "in_progress" },
                    { id: "step-2", description: "Create login endpoint", status: "pending" },
                    { id: "step-3", description: "Add token refresh", status: "pending" },
                ],
            });

            expect(wm.currentGoal).toBe("Implement JWT-based authentication");
            expect(wm.activePlanSteps).toHaveLength(3);
            expect(wm.activePlanSteps[0].status).toBe("in_progress");
        });

        it("accumulates tool results during execution", () => {
            let wm = createWorkingMemory(
                "lifecycle-task-004",
                TEST_TENANT_ID,
                "Research API frameworks"
            );

            // Simulate multiple tool calls
            wm = updateWorkingMemory(wm, {
                recentToolResults: [
                    {
                        toolName: "web_search",
                        input: "best Node.js API frameworks 2026",
                        output: "Top frameworks: Express, Fastify, Hono, Elysia",
                        timestamp: new Date().toISOString(),
                    },
                ],
            });

            wm = updateWorkingMemory(wm, {
                recentToolResults: [
                    ...wm.recentToolResults,
                    {
                        toolName: "read_documentation",
                        input: "Hono framework features",
                        output: "Lightweight, multi-runtime, Web Standard APIs",
                        timestamp: new Date().toISOString(),
                    },
                ],
            });

            expect(wm.recentToolResults).toHaveLength(2);
            expect(wm.currentTokenEstimate).toBeGreaterThan(0);
        });

        it("handles inter-agent messages", () => {
            let wm = createWorkingMemory(
                "lifecycle-task-005",
                TEST_TENANT_ID,
                "Coordinate between agents"
            );

            wm = updateWorkingMemory(wm, {
                interAgentMessages: [
                    {
                        fromAgent: "ideation",
                        toAgent: "planning",
                        content: "Here are 3 concept options for the feature",
                        timestamp: new Date().toISOString(),
                    },
                ],
            });

            expect(wm.interAgentMessages).toHaveLength(1);
            expect(wm.interAgentMessages[0].fromAgent).toBe("ideation");
        });

        it("enforces token budget by trimming oldest results", () => {
            let wm = createWorkingMemory(
                "lifecycle-task-006",
                TEST_TENANT_ID,
                "Budget enforcement test"
            );

            // Set a very small token budget
            wm = { ...wm, maxTokenBudget: 100 };

            // Add many large tool results
            const bigResults = Array.from({ length: 20 }, (_, i) => ({
                toolName: `tool-${i}`,
                input: `input-${i}`,
                output: "x".repeat(200),
                timestamp: new Date().toISOString(),
            }));
            wm = { ...wm, recentToolResults: bigResults };

            const enforced = enforceTokenBudget(wm);
            expect(enforced.recentToolResults.length).toBeLessThan(20);
        });
    });

    // ── Phase 4: Episode Recording ─────────────────────────

    describe("Phase 4: Record episode to PostgreSQL", () => {
        let recordedEpisodeId: string;

        it("records a completed episode via MemoryManager", async () => {
            const record = await manager.recordEpisode({
                agentType: "execution",
                taskDescription: "Lifecycle test — full end-to-end task",
                outcome: "Successfully implemented and tested the authentication system",
                durationMs: 15000,
                langsmithTraceId: "trace-lifecycle-e2e-001",
                metadata: { testSuite: "memory-lifecycle", phase: "e2e" },
            });

            expect(record).toBeDefined();
            expect(record.id).toBeDefined();
            expect(record.tenantId).toBe(TEST_TENANT_ID);
            expect(record.agentType).toBe("execution");
            expect(record.langsmithTraceId).toBe("trace-lifecycle-e2e-001");

            recordedEpisodeId = record.id;
        });

        it("recorded episode is retrievable from the database", async () => {
            const episodes = await manager.getRecentEpisodes(5);

            expect(episodes.length).toBeGreaterThanOrEqual(1);

            const found = episodes.find((ep) => ep.id === recordedEpisodeId);
            expect(found).toBeDefined();
            expect(found!.taskDescription).toBe(
                "Lifecycle test — full end-to-end task"
            );
        });
    });

    // ── Phase 5: Context Benefits ──────────────────────────

    describe("Phase 5: Next task benefits from recorded episode", () => {
        it("loadContext returns the previous episode as context", async () => {
            const wm = await manager.loadContext({
                taskId: "lifecycle-task-next",
                tenantId: TEST_TENANT_ID,
                taskDescription: "Continue building the authentication system",
                agentType: "execution",
            });

            expect(wm).toBeDefined();
            expect(wm.ragResults.length).toBeGreaterThanOrEqual(1);

            // Should include episodic context from the previous task
            const hasEpisodicContext = wm.ragResults.some(
                (r) => r.source === "episodic"
            );
            expect(hasEpisodicContext).toBe(true);
        });
    });

    // ── Phase 6: Working Memory Cleanup ────────────────────

    describe("Phase 6: Working Memory cleanup", () => {
        it("clearWorkingMemory returns a blank state", () => {
            const cleared = clearWorkingMemory();

            expect(cleared.taskDescription).toBe("");
            expect(cleared.currentGoal).toBe("");
            expect(cleared.activePlanSteps).toEqual([]);
            expect(cleared.recentToolResults).toEqual([]);
            expect(cleared.mcpCallResults).toEqual([]);
            expect(cleared.ragResults).toEqual([]);
            expect(cleared.interAgentMessages).toEqual([]);
            expect(cleared.loadedSkillDefinitions).toEqual([]);
            expect(cleared.currentTokenEstimate).toBe(0);
        });
    });

    // ── Multi-tenancy ──────────────────────────────────────

    describe("MemoryManager multi-tenancy", () => {
        it("MemoryManager scopes all operations to its tenantId", () => {
            const mgr1 = new MemoryManager("tenant-alpha");
            const mgr2 = new MemoryManager("tenant-beta");

            expect(mgr1.tenantId).toBe("tenant-alpha");
            expect(mgr2.tenantId).toBe("tenant-beta");
            expect(mgr1.tenantId).not.toBe(mgr2.tenantId);
        });

        it("episodes recorded by one tenant are not visible to another", async () => {
            const mgrA = new MemoryManager("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
            const mgrB = new MemoryManager("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");

            // Record episode for tenant A
            await mgrA.recordEpisode({
                agentType: "ideation",
                taskDescription: "Tenant A private task",
                outcome: "Private result",
                durationMs: 500,
                langsmithTraceId: "trace-tenant-a",
            });

            // Query from tenant B — should not see tenant A's episode
            const episodesB = await mgrB.getRecentEpisodes(100);
            const hasTenantAData = episodesB.some(
                (ep) => ep.taskDescription === "Tenant A private task"
            );
            expect(hasTenantAData).toBe(false);
        });
    });
});
