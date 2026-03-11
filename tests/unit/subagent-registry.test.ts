/**
 * Level 8 — Sub-agent Registry Tests
 *
 * Tests for the SubAgentRegistry:
 *   - Registration and tracking
 *   - State updates and lifecycle transitions
 *   - Parent-child relationship queries
 *   - System-wide queries for Heartbeat preparation
 *   - Await patterns and event-driven callbacks
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    SubAgentRegistry,
    getSubAgentRegistry,
    resetSubAgentRegistry,
} from "baseclaw-agent/src/subagent/registry.js";
import type { SubAgentState, SubAgentResult } from "baseclaw-agent/src/subagent/types.js";

// ── Helpers ──────────────────────────────────────────────

function makeSubAgentState(overrides: Partial<SubAgentState> = {}): SubAgentState {
    return {
        id: `ideation-sub-${Date.now()}`,
        parentAgentId: "parent-1",
        agentType: "ideation",
        status: "running",
        task: "Test task",
        tenantId: "tenant-test",
        inheritedSkillIds: ["skill-1"],
        inheritedMCPServerIds: ["mcp-1"],
        ownMCPServerIds: [],
        traceId: "trace-sub-1",
        parentTraceId: "trace-parent-1",
        workingMemory: null,
        spawnedAt: new Date().toISOString(),
        ...overrides,
    };
}

function makeResult(overrides: Partial<SubAgentResult> = {}): SubAgentResult {
    return {
        output: "Test output",
        metadata: {
            subAgentId: "test-sub",
            agentType: "ideation",
            durationMs: 1000,
            iterationsUsed: 1,
            skillsUsed: [],
            mcpToolsCalled: [],
            traceId: "trace-1",
        },
        executionSummary: "Completed test task",
        ...overrides,
    };
}

describe("Level 8 — Sub-agent Registry", () => {
    let registry: SubAgentRegistry;

    beforeEach(() => {
        registry = new SubAgentRegistry();
    });

    afterEach(() => {
        registry.clear();
    });

    describe("Registration", () => {
        it("registers a sub-agent", () => {
            const state = makeSubAgentState({ id: "sa-1" });
            registry.register(state);

            expect(registry.size).toBe(1);
            expect(registry.getSubAgent("sa-1")).toBeDefined();
            expect(registry.getSubAgent("sa-1")?.status).toBe("running");
        });

        it("tracks parent-child relationships", () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "parent-1" }));
            registry.register(makeSubAgentState({ id: "sa-2", parentAgentId: "parent-1" }));
            registry.register(makeSubAgentState({ id: "sa-3", parentAgentId: "parent-2" }));

            const p1Active = registry.getActiveSubAgents("parent-1");
            expect(p1Active).toHaveLength(2);

            const p2Active = registry.getActiveSubAgents("parent-2");
            expect(p2Active).toHaveLength(1);
        });
    });

    describe("State Updates", () => {
        it("updates sub-agent state", () => {
            const state = makeSubAgentState({ id: "sa-1" });
            registry.register(state);

            const updated = registry.updateState("sa-1", { status: "completed" });
            expect(updated?.status).toBe("completed");
        });

        it("returns undefined for non-existent sub-agent", () => {
            const result = registry.updateState("non-existent", { status: "completed" });
            expect(result).toBeUndefined();
        });
    });

    describe("Lifecycle Transitions", () => {
        it("marks sub-agent as completed", () => {
            const state = makeSubAgentState({ id: "sa-1" });
            registry.register(state);

            const result = makeResult();
            registry.markCompleted("sa-1", result);

            const sa = registry.getSubAgent("sa-1");
            expect(sa?.status).toBe("completed");
            expect(sa?.result).toBeDefined();
            expect(sa?.completedAt).toBeDefined();
        });

        it("marks sub-agent as failed", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            registry.markFailed("sa-1", "Something went wrong");

            const sa = registry.getSubAgent("sa-1");
            expect(sa?.status).toBe("error");
            expect(sa?.error).toBe("Something went wrong");
        });

        it("marks sub-agent as timed out", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            registry.markTimedOut("sa-1");

            const sa = registry.getSubAgent("sa-1");
            expect(sa?.status).toBe("timed_out");
        });

        it("marks sub-agent as cancelled", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            registry.markCancelled("sa-1", "Parent cancelled");

            const sa = registry.getSubAgent("sa-1");
            expect(sa?.status).toBe("cancelled");
            expect(sa?.error).toBe("Parent cancelled");
        });
    });

    describe("Removal", () => {
        it("removes a sub-agent from the registry", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            expect(registry.size).toBe(1);

            registry.remove("sa-1");
            expect(registry.size).toBe(0);
            expect(registry.getSubAgent("sa-1")).toBeUndefined();
        });

        it("cleans up parent-child mapping on removal", () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "parent-1" }));
            registry.register(makeSubAgentState({ id: "sa-2", parentAgentId: "parent-1" }));

            registry.remove("sa-1");
            expect(registry.getActiveSubAgents("parent-1")).toHaveLength(1);

            registry.remove("sa-2");
            expect(registry.getActiveSubAgents("parent-1")).toHaveLength(0);
        });
    });

    describe("Active Count", () => {
        it("counts only active sub-agents", () => {
            registry.register(makeSubAgentState({ id: "sa-1", status: "running", parentAgentId: "p1" }));
            registry.register(makeSubAgentState({ id: "sa-2", status: "pending", parentAgentId: "p1" }));
            registry.register(makeSubAgentState({ id: "sa-3", status: "running", parentAgentId: "p1" }));

            expect(registry.getActiveCount("p1")).toBe(3);

            registry.markCompleted("sa-1", makeResult());
            expect(registry.getActiveCount("p1")).toBe(2);
        });
    });

    describe("System-wide Queries (Heartbeat Prep)", () => {
        it("returns all active sub-agents across parents", () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "p1" }));
            registry.register(makeSubAgentState({ id: "sa-2", parentAgentId: "p2" }));

            const systemWide = registry.getSystemWideActiveSubAgents();
            expect(systemWide).toHaveLength(2);
        });

        it("hasAnyActive returns true when sub-agents are running", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            expect(registry.hasAnyActive()).toBe(true);
        });

        it("hasAnyActive returns false when no sub-agents", () => {
            expect(registry.hasAnyActive()).toBe(false);
        });

        it("hasAnyActive returns false when all completed", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            registry.markCompleted("sa-1", makeResult());
            expect(registry.hasAnyActive()).toBe(false);
        });
    });

    describe("Await Patterns", () => {
        it("awaitSubAgent resolves immediately if already completed", async () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            const result = makeResult();
            registry.markCompleted("sa-1", result);

            const awaited = await registry.awaitSubAgent("sa-1");
            expect(awaited).toBeDefined();
            expect(awaited?.output).toBe("Test output");
        });

        it("awaitSubAgent returns null for non-existent sub-agent", async () => {
            const result = await registry.awaitSubAgent("non-existent");
            expect(result).toBeNull();
        });

        it("awaitSubAgent resolves when sub-agent completes", async () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));

            // Simulate async completion
            setTimeout(() => {
                registry.markCompleted("sa-1", makeResult());
            }, 50);

            const result = await registry.awaitSubAgent("sa-1", 5000);
            expect(result).toBeDefined();
            expect(result?.output).toBe("Test output");
        });

        it("awaitAllSubAgents resolves when all complete", async () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "p1" }));
            registry.register(makeSubAgentState({ id: "sa-2", parentAgentId: "p1" }));

            setTimeout(() => {
                registry.markCompleted("sa-1", makeResult({ output: "Result 1" }));
            }, 30);

            setTimeout(() => {
                registry.markCompleted("sa-2", makeResult({ output: "Result 2" }));
            }, 60);

            const results = await registry.awaitAllSubAgents("p1", 5000);
            expect(results).toHaveLength(2);
        });

        it("onSubAgentComplete fires callback on completion", async () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "p1" }));

            const completedIds: string[] = [];
            const unsub = registry.onSubAgentComplete("p1", (subId) => {
                completedIds.push(subId);
            });

            registry.markCompleted("sa-1", makeResult());

            // Wait a tick for the event to fire
            await new Promise((r) => setTimeout(r, 10));

            expect(completedIds).toContain("sa-1");
            unsub();
        });
    });

    describe("Singleton", () => {
        afterEach(() => {
            resetSubAgentRegistry();
        });

        it("getSubAgentRegistry returns a singleton", () => {
            const r1 = getSubAgentRegistry();
            const r2 = getSubAgentRegistry();
            expect(r1).toBe(r2);
        });

        it("resetSubAgentRegistry clears the singleton", () => {
            const r1 = getSubAgentRegistry();
            r1.register(makeSubAgentState({ id: "sa-1" }));
            expect(r1.size).toBe(1);

            resetSubAgentRegistry();

            const r2 = getSubAgentRegistry();
            expect(r2.size).toBe(0);
            expect(r1).not.toBe(r2);
        });
    });

    describe("Result Retrieval", () => {
        it("getSubAgentResult returns result for completed sub-agent", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            const result = makeResult();
            registry.markCompleted("sa-1", result);

            const retrieved = registry.getSubAgentResult("sa-1");
            expect(retrieved).toBeDefined();
            expect(retrieved?.output).toBe("Test output");
        });

        it("getSubAgentResult returns undefined for running sub-agent", () => {
            registry.register(makeSubAgentState({ id: "sa-1" }));
            const result = registry.getSubAgentResult("sa-1");
            expect(result).toBeUndefined();
        });

        it("getSubAgentResult returns undefined for unknown sub-agent", () => {
            const result = registry.getSubAgentResult("non-existent");
            expect(result).toBeUndefined();
        });
    });
});
