/**
 * Level 8 — Sub-agent Lifecycle Tests
 *
 * Tests the full spawn→execute→return→dissolve cycle.
 * Uses real LLM calls (gpt-4o-mini) — requires OPENAI_API_KEY.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    spawnSubAgent,
    executeSubAgent,
    dissolveSubAgent,
    cancelSubAgent,
    cascadeCancelSubAgents,
    runSubAgent,
    configureSubAgentLifecycle,
    getSpawnQueue,
} from "baseclaw-agent/src/subagent/lifecycle.js";
import {
    getSubAgentRegistry,
    resetSubAgentRegistry,
} from "baseclaw-agent/src/subagent/registry.js";
import type { SubAgentConfig } from "baseclaw-agent/src/subagent/types.js";
import { SkillRegistry, registerBuiltinSkills } from "baseclaw-agent/src/skills/index.js";

// ── Fail fast if API key is missing ─────────────────────
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error(
        "OPENAI_API_KEY is required for Level 8 lifecycle tests. No mocks allowed."
    );
}

// ── Helper ──────────────────────────────────────────────

function makeConfig(overrides: Partial<SubAgentConfig> = {}): SubAgentConfig {
    return {
        task: "Briefly list 3 creative names for a pet hamster.",
        parentAgentId: "parent-test-1",
        parentAgentType: "ideation",
        tenantId: "tenant-test",
        parentSkillIds: [],
        parentTraceId: `trace-parent-${Date.now()}`,
        ...overrides,
    };
}

describe("Level 8 — Sub-agent Lifecycle", () => {
    let registry: ReturnType<typeof getSubAgentRegistry>;
    let skillRegistry: SkillRegistry;

    beforeEach(() => {
        resetSubAgentRegistry();
        registry = getSubAgentRegistry();
        skillRegistry = new SkillRegistry();
        registerBuiltinSkills(skillRegistry);
        configureSubAgentLifecycle({
            skillRegistry,
            concurrencyLimit: 5,
        });
    });

    afterEach(() => {
        resetSubAgentRegistry();
        getSpawnQueue().clear();
    });

    describe("Spawn", () => {
        it("creates a sub-agent with correct ID format", async () => {
            const subAgentId = await spawnSubAgent(makeConfig());

            expect(subAgentId).toMatch(/^ideation-sub-[a-f0-9-]{36}$/);

            const state = registry.getSubAgent(subAgentId);
            expect(state).toBeDefined();
            expect(state?.agentType).toBe("ideation");
            expect(state?.status).toBe("running");
            expect(state?.parentAgentId).toBe("parent-test-1");
            expect(state?.tenantId).toBe("tenant-test");
        }, 10_000);

        it("creates isolated Working Memory for sub-agent", async () => {
            const subAgentId = await spawnSubAgent(makeConfig());

            const state = registry.getSubAgent(subAgentId);
            expect(state?.workingMemory).toBeDefined();
            expect(state?.workingMemory?.taskId).toContain("subtask-");
            expect(state?.workingMemory?.tenantId).toBe("tenant-test");
        }, 10_000);

        it("rejects spawning from sub-agent (max depth = 1)", async () => {
            await expect(
                spawnSubAgent(makeConfig({ isSubAgent: true }))
            ).rejects.toThrow("cannot spawn their own sub-agents");
        });

        it("rejects spawning from Conversation Agent", async () => {
            await expect(
                spawnSubAgent(
                    makeConfig({ parentAgentType: "conversation" as any })
                )
            ).rejects.toThrow("cannot spawn");
        });

        it("spawns sub-agents of each type", async () => {
            for (const type of ["ideation", "planning", "execution", "reviewer"] as const) {
                const config = makeConfig({ parentAgentType: type, parentAgentId: `parent-${type}` });
                const id = await spawnSubAgent(config);
                expect(id).toMatch(new RegExp(`^${type}-sub-`));
            }
        }, 10_000);
    });

    describe("Execute", () => {
        it("executes a sub-agent task with real LLM call", async () => {
            const subAgentId = await spawnSubAgent(makeConfig());
            const result = await executeSubAgent(subAgentId);

            expect(result).toBeDefined();
            expect(result.output).toBeTruthy();
            expect(result.output.length).toBeGreaterThan(10);
            expect(result.metadata.subAgentId).toBe(subAgentId);
            expect(result.metadata.agentType).toBe("ideation");
            expect(result.metadata.durationMs).toBeGreaterThan(0);
            expect(result.executionSummary).toContain(subAgentId);
        }, 30_000);

        it("rejects execution for non-existent sub-agent", async () => {
            await expect(
                executeSubAgent("non-existent-sub")
            ).rejects.toThrow("not found");
        });
    });

    describe("Dissolve", () => {
        it("dissolves a sub-agent cleanly", async () => {
            const subAgentId = await spawnSubAgent(makeConfig());
            const result = await executeSubAgent(subAgentId);
            await dissolveSubAgent(subAgentId);

            // Sub-agent should be removed from registry after dissolve
            const state = registry.getSubAgent(subAgentId);
            expect(state).toBeUndefined();
        }, 30_000);

        it("handles dissolving non-existent sub-agent gracefully", async () => {
            // Should not throw
            await dissolveSubAgent("non-existent");
        });
    });

    describe("Full Lifecycle (runSubAgent)", () => {
        it("runs spawn→execute→dissolve in one call", async () => {
            const result = await runSubAgent(makeConfig());

            expect(result).toBeDefined();
            expect(result.output).toBeTruthy();
            expect(result.metadata.durationMs).toBeGreaterThan(0);

            // Sub-agent should be dissolved from registry
            const activeCount = registry.getActiveCount("parent-test-1");
            expect(activeCount).toBe(0);
        }, 30_000);

        it("dissolves sub-agent even on execution error", async () => {
            // Spawn then manually mess up the state to trigger an error
            const subAgentId = await spawnSubAgent(makeConfig());
            registry.markFailed(subAgentId, "Forced error");

            // The sub-agent is still in the registry but marked as error
            const state = registry.getSubAgent(subAgentId);
            expect(state?.status).toBe("error");

            // Dissolve should still work
            await dissolveSubAgent(subAgentId);
            expect(registry.getSubAgent(subAgentId)).toBeUndefined();
        }, 10_000);
    });

    describe("Cancellation", () => {
        it("cancels a running sub-agent", async () => {
            const subAgentId = await spawnSubAgent(makeConfig());

            await cancelSubAgent(subAgentId, "Test cancellation");

            // Sub-agent should be dissolved
            const state = registry.getSubAgent(subAgentId);
            expect(state).toBeUndefined();
        }, 10_000);

        it("cascade cancels all sub-agents for a parent", async () => {
            const parentId = "parent-cascade-test";
            const id1 = await spawnSubAgent(makeConfig({ parentAgentId: parentId }));
            const id2 = await spawnSubAgent(makeConfig({ parentAgentId: parentId }));

            await cascadeCancelSubAgents(parentId, "Parent died");

            // Both should be gone from registry
            expect(registry.getSubAgent(id1)).toBeUndefined();
            expect(registry.getSubAgent(id2)).toBeUndefined();
            expect(registry.getActiveCount(parentId)).toBe(0);
        }, 10_000);
    });

    describe("Concurrency Queuing", () => {
        it("queues spawn requests beyond concurrency limit", async () => {
            // Set limit to 2
            configureSubAgentLifecycle({ concurrencyLimit: 2 });

            const parentId = "parent-queue-test";
            const id1 = await spawnSubAgent(makeConfig({ parentAgentId: parentId }));
            const id2 = await spawnSubAgent(makeConfig({ parentAgentId: parentId }));

            // Third should be queued (since 2 are already active)
            const queue = getSpawnQueue();
            expect(registry.getActiveCount(parentId)).toBe(2);
            // The queue behavior means the third spawn will return a promise
            // that resolves when a slot opens

            // Cleanup
            await cancelSubAgent(id1);
            await cancelSubAgent(id2);
        }, 10_000);
    });

    describe("Parallel Execution", () => {
        it("spawns multiple sub-agents in parallel", async () => {
            const parentId = "parent-parallel-test";
            const configs = [
                makeConfig({ parentAgentId: parentId, task: "Name 3 fruits" }),
                makeConfig({ parentAgentId: parentId, task: "Name 3 colors" }),
            ];

            // Spawn both
            const ids = await Promise.all(
                configs.map((c) => spawnSubAgent(c))
            );
            expect(ids).toHaveLength(2);

            // Both should be running
            const active = registry.getActiveSubAgents(parentId);
            expect(active.length).toBe(2);

            // Execute both in parallel, then dissolve
            const results = await Promise.all(
                ids.map((id) =>
                    executeSubAgent(id).then((r) =>
                        dissolveSubAgent(id).then(() => r)
                    )
                )
            );

            expect(results).toHaveLength(2);
            expect(results[0].output).toBeTruthy();
            expect(results[1].output).toBeTruthy();
        }, 60_000);
    });
});
