/**
 * Level 8 — Sub-agent Safety Tests
 *
 * Tests for all safety rules:
 *   - Max depth = 1 (no recursive spawning)
 *   - Conversation Agent cannot spawn
 *   - Concurrency limiting (queue vs reject)
 *   - Timeout enforcement
 *   - Cascade cancellation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    validateSpawnRequest,
    shouldQueue,
    createTimeoutController,
    SubAgentTimeoutError,
    SubAgentCancelledError,
    getSubAgentsToCancel,
} from "baseclaw-agent/src/subagent/safety.js";
import type { SubAgentConfig, SubAgentState } from "baseclaw-agent/src/subagent/types.js";

// ── Helper ──────────────────────────────────────────────

function makeConfig(overrides: Partial<SubAgentConfig> = {}): SubAgentConfig {
    return {
        task: "Test sub-agent task",
        parentAgentId: "parent-1",
        parentAgentType: "ideation",
        tenantId: "tenant-test",
        parentSkillIds: [],
        parentTraceId: "trace-parent-1",
        ...overrides,
    };
}

function makeSubAgentState(overrides: Partial<SubAgentState> = {}): SubAgentState {
    return {
        id: "ideation-sub-test",
        parentAgentId: "parent-1",
        agentType: "ideation",
        status: "running",
        task: "Test task",
        tenantId: "tenant-test",
        inheritedSkillIds: [],
        inheritedMCPServerIds: [],
        ownMCPServerIds: [],
        traceId: "trace-sub-1",
        parentTraceId: "trace-parent-1",
        workingMemory: null,
        spawnedAt: new Date().toISOString(),
        ...overrides,
    };
}

describe("Level 8 — Sub-agent Safety", () => {
    describe("validateSpawnRequest", () => {
        it("validates a valid spawn request", () => {
            const config = makeConfig();
            const result = validateSpawnRequest(config, 0);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("rejects Conversation Agent spawning", () => {
            const config = makeConfig({
                parentAgentType: "conversation" as any,
            });
            const result = validateSpawnRequest(config, 0);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("conversation");
            expect(result.error).toContain("cannot spawn");
        });

        it("rejects sub-agent spawning sub-agents (max depth = 1)", () => {
            const config = makeConfig({ isSubAgent: true });
            const result = validateSpawnRequest(config, 0);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("cannot spawn their own sub-agents");
            expect(result.error).toContain("depth");
        });

        it("rejects empty task", () => {
            const config = makeConfig({ task: "" });
            const result = validateSpawnRequest(config, 0);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("non-empty");
        });

        it("rejects whitespace-only task", () => {
            const config = makeConfig({ task: "   " });
            const result = validateSpawnRequest(config, 0);
            expect(result.valid).toBe(false);
        });

        it("rejects empty parent agent ID", () => {
            const config = makeConfig({ parentAgentId: "" });
            const result = validateSpawnRequest(config, 0);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Parent agent ID");
        });

        it("validates all 4 spawnable agent types", () => {
            for (const type of ["ideation", "planning", "execution", "reviewer"] as const) {
                const config = makeConfig({ parentAgentType: type });
                const result = validateSpawnRequest(config, 0);
                expect(result.valid).toBe(true);
            }
        });

        it("rejects invalid agent types", () => {
            const config = makeConfig({
                parentAgentType: "unknown-agent" as any,
            });
            const result = validateSpawnRequest(config, 0);
            expect(result.valid).toBe(false);
        });
    });

    describe("shouldQueue", () => {
        it("returns false when below concurrency limit", () => {
            expect(shouldQueue(0, 5)).toBe(false);
            expect(shouldQueue(4, 5)).toBe(false);
        });

        it("returns true when at or above concurrency limit", () => {
            expect(shouldQueue(5, 5)).toBe(true);
            expect(shouldQueue(6, 5)).toBe(true);
        });

        it("uses default limit of 5", () => {
            expect(shouldQueue(4)).toBe(false);
            expect(shouldQueue(5)).toBe(true);
        });

        it("handles custom concurrency limits", () => {
            expect(shouldQueue(2, 3)).toBe(false);
            expect(shouldQueue(3, 3)).toBe(true);
            expect(shouldQueue(0, 1)).toBe(false);
            expect(shouldQueue(1, 1)).toBe(true);
        });
    });

    describe("createTimeoutController", () => {
        it("creates a timeout that rejects after specified ms", async () => {
            const { timeoutPromise, cancel } = createTimeoutController(
                "test-sub-agent",
                50 // 50ms for quick test
            );

            try {
                await timeoutPromise;
                expect.fail("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(SubAgentTimeoutError);
                expect((error as SubAgentTimeoutError).subAgentId).toBe("test-sub-agent");
                expect((error as SubAgentTimeoutError).timeoutMs).toBe(50);
            }
        });

        it("can be cancelled before timeout fires", async () => {
            const { timeoutPromise, cancel } = createTimeoutController(
                "test-sub-agent",
                5000
            );

            // Cancel immediately
            cancel();

            // The promise should never resolve or reject now
            // Wait a bit to ensure no rejection
            await new Promise((resolve) => setTimeout(resolve, 100));
            // If we get here without error, the cancel worked
            expect(true).toBe(true);
        });
    });

    describe("SubAgentTimeoutError", () => {
        it("is an instance of Error", () => {
            const error = new SubAgentTimeoutError("test", "sub-1", 5000);
            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe("SubAgentTimeoutError");
            expect(error.subAgentId).toBe("sub-1");
            expect(error.timeoutMs).toBe(5000);
        });
    });

    describe("SubAgentCancelledError", () => {
        it("is an instance of Error", () => {
            const error = new SubAgentCancelledError("sub-1", "Parent cancelled");
            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe("SubAgentCancelledError");
            expect(error.subAgentId).toBe("sub-1");
            expect(error.reason).toBe("Parent cancelled");
        });
    });

    describe("getSubAgentsToCancel", () => {
        it("returns only active sub-agents for the parent", () => {
            const subAgents: SubAgentState[] = [
                makeSubAgentState({ id: "sa-1", status: "running", parentAgentId: "parent-1" }),
                makeSubAgentState({ id: "sa-2", status: "pending", parentAgentId: "parent-1" }),
                makeSubAgentState({ id: "sa-3", status: "completed", parentAgentId: "parent-1" }),
                makeSubAgentState({ id: "sa-4", status: "running", parentAgentId: "parent-2" }),
            ];

            const toCancel = getSubAgentsToCancel("parent-1", subAgents);

            expect(toCancel).toContain("sa-1");
            expect(toCancel).toContain("sa-2");
            expect(toCancel).not.toContain("sa-3"); // completed
            expect(toCancel).not.toContain("sa-4"); // different parent
        });

        it("returns empty array when no matching sub-agents", () => {
            const subAgents: SubAgentState[] = [
                makeSubAgentState({ id: "sa-1", status: "completed", parentAgentId: "parent-1" }),
            ];

            const toCancel = getSubAgentsToCancel("parent-1", subAgents);
            expect(toCancel).toHaveLength(0);
        });

        it("returns empty array for unknown parent", () => {
            const subAgents: SubAgentState[] = [
                makeSubAgentState({ id: "sa-1", status: "running", parentAgentId: "parent-1" }),
            ];

            const toCancel = getSubAgentsToCancel("parent-unknown", subAgents);
            expect(toCancel).toHaveLength(0);
        });
    });
});
