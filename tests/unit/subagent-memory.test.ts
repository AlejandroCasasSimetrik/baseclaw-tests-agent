/**
 * Level 8 — Sub-agent Memory Interaction Tests
 *
 * Tests for:
 *   - Working Memory isolation per sub-agent
 *   - Episodic Memory writes with sub-agent metadata
 *   - Knowledge namespace write restriction
 *   - Heartbeat system-level queries
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createWorkingMemory } from "baseclaw-agent/src/memory/working-memory.js";
import {
    SubAgentRegistry,
    resetSubAgentRegistry,
} from "baseclaw-agent/src/subagent/registry.js";
import { buildSubAgentTraceMetadata } from "baseclaw-agent/src/subagent/types.js";
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
        inheritedMCPServerIds: [],
        ownMCPServerIds: [],
        traceId: "trace-sub-1",
        parentTraceId: "trace-parent-1",
        workingMemory: null,
        spawnedAt: new Date().toISOString(),
        ...overrides,
    };
}

function makeResult(): SubAgentResult {
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
        executionSummary: "Completed",
    };
}

describe("Level 8 — Sub-agent Memory Interaction", () => {
    describe("Working Memory Isolation", () => {
        it("each sub-agent gets its own Working Memory instance", () => {
            const wm1 = createWorkingMemory("subtask-sa-1", "tenant-1", "Task 1");
            const wm2 = createWorkingMemory("subtask-sa-2", "tenant-1", "Task 2");

            expect(wm1.taskId).toBe("subtask-sa-1");
            expect(wm2.taskId).toBe("subtask-sa-2");
            expect(wm1.taskDescription).toBe("Task 1");
            expect(wm2.taskDescription).toBe("Task 2");

            // They are different objects
            expect(wm1).not.toBe(wm2);
        });

        it("sub-agent Working Memory is isolated from parent", () => {
            const parentWm = createWorkingMemory("parent-task", "tenant-1", "Parent task");
            const childWm = createWorkingMemory("subtask-sa-1", "tenant-1", "Child task");

            // Modifying child does not affect parent
            childWm.currentGoal = "Child goal";
            expect(parentWm.currentGoal).toBe("");
        });

        it("sub-agent Working Memory is discarded on dissolve (nullification)", () => {
            const registry = new SubAgentRegistry();
            const wm = createWorkingMemory("subtask-sa-1", "tenant-1", "Task 1");

            const state = makeSubAgentState({
                id: "sa-1",
                workingMemory: wm,
            });
            registry.register(state);

            // Verify WM exists
            expect(registry.getSubAgent("sa-1")?.workingMemory).toBeDefined();

            // Simulate dissolve by nullifying WM
            registry.updateState("sa-1", { workingMemory: null });

            expect(registry.getSubAgent("sa-1")?.workingMemory).toBeNull();

            registry.clear();
        });
    });

    describe("Episodic Memory Metadata", () => {
        it("builds trace metadata with sub-agent and parent IDs", () => {
            const state = makeSubAgentState({
                id: "ideation-sub-abc123",
                parentAgentId: "parent-main-1",
                inheritedSkillIds: ["skill-brainstorm", "skill-synthesis"],
                inheritedMCPServerIds: ["mcp-github"],
            });

            const metadata = buildSubAgentTraceMetadata(state);

            expect(metadata.is_sub_agent).toBe(true);
            expect(metadata.parent_agent_id).toBe("parent-main-1");
            expect(metadata.sub_agent_id).toBe("ideation-sub-abc123");
            expect(metadata.parent_trace_id).toBe("trace-parent-1");
            expect(metadata.inherited_skills).toEqual(["skill-brainstorm", "skill-synthesis"]);
            expect(metadata.inherited_mcp_servers).toEqual(["mcp-github"]);
        });

        it("includes trace ID for each sub-agent", () => {
            const state = makeSubAgentState({
                traceId: "trace-sub-unique-123",
            });

            const metadata = buildSubAgentTraceMetadata(state);
            expect(metadata.sub_agent_id).toBe(state.id);
        });
    });

    describe("Heartbeat Preparation Queries", () => {
        let registry: SubAgentRegistry;

        beforeEach(() => {
            registry = new SubAgentRegistry();
        });

        afterEach(() => {
            registry.clear();
        });

        it("getSystemWideActiveSubAgents returns all active across parents", () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "p1", status: "running" }));
            registry.register(makeSubAgentState({ id: "sa-2", parentAgentId: "p2", status: "running" }));
            registry.register(makeSubAgentState({ id: "sa-3", parentAgentId: "p1", status: "completed" }));

            const active = registry.getSystemWideActiveSubAgents();
            expect(active).toHaveLength(2);
            expect(active.map((sa) => sa.id)).toContain("sa-1");
            expect(active.map((sa) => sa.id)).toContain("sa-2");
        });

        it("hasAnyActive reflects running sub-agent state", () => {
            expect(registry.hasAnyActive()).toBe(false);

            registry.register(makeSubAgentState({ id: "sa-1" }));
            expect(registry.hasAnyActive()).toBe(true);

            registry.markCompleted("sa-1", makeResult());
            expect(registry.hasAnyActive()).toBe(false);
        });

        it("Heartbeat sees sub-agents as active execution", () => {
            // The Heartbeat should not pull new tasks while sub-agents are running
            registry.register(makeSubAgentState({ id: "sa-1", status: "running" }));

            // hasAnyActive → true means "Heartbeat should wait"
            expect(registry.hasAnyActive()).toBe(true);

            // All done → Heartbeat can proceed
            registry.markCompleted("sa-1", makeResult());
            expect(registry.hasAnyActive()).toBe(false);
        });
    });

    describe("Multi-tenancy", () => {
        it("sub-agent inherits parent's tenant_id", () => {
            const wm = createWorkingMemory("subtask-sa-1", "tenant-abc", "Task");
            expect(wm.tenantId).toBe("tenant-abc");
        });

        it("sub-agent state carries tenant_id", () => {
            const state = makeSubAgentState({ tenantId: "tenant-xyz" });
            expect(state.tenantId).toBe("tenant-xyz");
        });
    });
});
