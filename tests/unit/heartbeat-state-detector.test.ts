/**
 * Level 9 — System State Detector Tests
 *
 * Tests for Executing/Idle/Waiting detection using real
 * SubAgentRegistry and HITLManager instances.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    detectSystemState,
    incrementActiveInvocations,
    decrementActiveInvocations,
    getActiveInvocationCount,
    resetActiveInvocations,
} from "baseclaw-agent/src/heartbeat/state-detector.js";
import {
    SubAgentRegistry,
} from "baseclaw-agent/src/subagent/registry.js";
import {
    HITLManager,
} from "baseclaw-agent/src/hitl/pause-resume.js";
import type { SubAgentState } from "baseclaw-agent/src/subagent/types.js";

function makeSubAgentState(id: string, status: "running" | "pending" | "completed" = "running"): SubAgentState {
    return {
        id,
        parentAgentId: "parent-1",
        agentType: "ideation",
        status,
        task: "Test task",
        tenantId: "test",
        inheritedSkillIds: [],
        inheritedMCPServerIds: [],
        ownMCPServerIds: [],
        traceId: "trace-1",
        parentTraceId: "trace-parent",
        workingMemory: null,
        spawnedAt: new Date().toISOString(),
    };
}

describe("Level 9 — State Detector", () => {
    let subAgentRegistry: SubAgentRegistry;
    let hitlManager: HITLManager;

    beforeEach(() => {
        subAgentRegistry = new SubAgentRegistry();
        hitlManager = new HITLManager();
        resetActiveInvocations();
    });

    afterEach(() => {
        subAgentRegistry.clear();
        hitlManager.reset();
        resetActiveInvocations();
    });

    describe("Active Invocation Counter", () => {
        it("starts at zero", () => {
            expect(getActiveInvocationCount()).toBe(0);
        });

        it("increments and decrements", () => {
            incrementActiveInvocations();
            expect(getActiveInvocationCount()).toBe(1);
            incrementActiveInvocations();
            expect(getActiveInvocationCount()).toBe(2);
            decrementActiveInvocations();
            expect(getActiveInvocationCount()).toBe(1);
        });

        it("does not go below zero", () => {
            decrementActiveInvocations();
            decrementActiveInvocations();
            expect(getActiveInvocationCount()).toBe(0);
        });

        it("resets to zero", () => {
            incrementActiveInvocations();
            incrementActiveInvocations();
            resetActiveInvocations();
            expect(getActiveInvocationCount()).toBe(0);
        });
    });

    describe("detectSystemState", () => {
        it("returns 'idle' when nothing is active", () => {
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("idle");
        });

        it("returns 'executing' when main agent is active", () => {
            incrementActiveInvocations();
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("executing");
        });

        it("returns 'executing' when sub-agents are active", () => {
            subAgentRegistry.register(makeSubAgentState("sa-1", "running"));
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("executing");
        });

        it("returns 'executing' when both main and sub-agents are active", () => {
            incrementActiveInvocations();
            subAgentRegistry.register(makeSubAgentState("sa-1", "running"));
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("executing");
        });

        it("returns 'waiting' when blocking HITL is pending", () => {
            hitlManager.pause({
                id: "req-1",
                reason: "Test",
                context: {},
                options: null,
                blocking: true,
                triggeredBy: "reviewer",
                tenantId: "test",
                createdAt: new Date().toISOString(),
                langsmithTraceId: "trace-1",
            });
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("waiting");
        });

        it("returns 'idle' when non-blocking HITL notification is present", () => {
            hitlManager.notify({
                id: "req-1",
                reason: "Task completed",
                context: {},
                options: null,
                blocking: false,
                triggeredBy: "reviewer",
                tenantId: "test",
                createdAt: new Date().toISOString(),
                langsmithTraceId: "trace-1",
            });
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("idle");
        });

        it("'waiting' takes priority over 'executing'", () => {
            incrementActiveInvocations();
            subAgentRegistry.register(makeSubAgentState("sa-1", "running"));
            hitlManager.pause({
                id: "req-1",
                reason: "Test",
                context: {},
                options: null,
                blocking: true,
                triggeredBy: "reviewer",
                tenantId: "test",
                createdAt: new Date().toISOString(),
                langsmithTraceId: "trace-1",
            });
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("waiting");
        });

        it("returns 'idle' when all sub-agents are completed", () => {
            subAgentRegistry.register(makeSubAgentState("sa-1", "running"));
            subAgentRegistry.markCompleted("sa-1", {
                output: "done",
                metadata: {
                    subAgentId: "sa-1",
                    agentType: "ideation",
                    durationMs: 100,
                    iterationsUsed: 1,
                    skillsUsed: [],
                    mcpToolsCalled: [],
                    traceId: "t-1",
                },
                executionSummary: "done",
            });
            const state = detectSystemState(subAgentRegistry, hitlManager);
            expect(state).toBe("idle");
        });

        it("returns 'idle' after HITL is resolved", () => {
            hitlManager.pause({
                id: "req-1",
                reason: "Test",
                context: {},
                options: null,
                blocking: true,
                triggeredBy: "reviewer",
                tenantId: "test",
                createdAt: new Date().toISOString(),
                langsmithTraceId: "trace-1",
            });
            expect(detectSystemState(subAgentRegistry, hitlManager)).toBe("waiting");

            hitlManager.resume({
                requestId: "req-1",
                userInput: "approved",
                respondedAt: new Date().toISOString(),
            });
            expect(detectSystemState(subAgentRegistry, hitlManager)).toBe("idle");
        });
    });
});
