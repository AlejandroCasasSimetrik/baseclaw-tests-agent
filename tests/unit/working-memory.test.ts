import { describe, it, expect, beforeEach } from "vitest";
import {
    createWorkingMemory,
    updateWorkingMemory,
    estimateTokens,
    enforceTokenBudget,
    clearWorkingMemory,
} from "baseclaw-agent/src/memory/working-memory.js";
import type { WorkingMemoryState, ToolResult } from "baseclaw-agent/src/memory/types.js";

describe("Working Memory", () => {
    // ── createWorkingMemory ────────────────────────────────

    describe("createWorkingMemory()", () => {
        it("returns a properly initialized state with defaults", () => {
            const wm = createWorkingMemory();
            expect(wm.taskId).toBeDefined();
            expect(wm.taskId.length).toBeGreaterThan(0);
            expect(wm.tenantId).toBe("");
            expect(wm.taskDescription).toBe("");
            expect(wm.currentGoal).toBe("");
            expect(wm.activePlanSteps).toEqual([]);
            expect(wm.recentToolResults).toEqual([]);
            expect(wm.mcpCallResults).toEqual([]);
            expect(wm.ragResults).toEqual([]);
            expect(wm.interAgentMessages).toEqual([]);
            expect(wm.loadedSkillDefinitions).toEqual([]);
            expect(wm.createdAt).toBeDefined();
            expect(wm.maxTokenBudget).toBe(100_000);
            expect(wm.currentTokenEstimate).toBe(0);
        });

        it("accepts custom taskId, tenantId, and taskDescription", () => {
            const wm = createWorkingMemory(
                "task-123",
                "tenant-abc",
                "Build a feature"
            );
            expect(wm.taskId).toBe("task-123");
            expect(wm.tenantId).toBe("tenant-abc");
            expect(wm.taskDescription).toBe("Build a feature");
        });
    });

    // ── updateWorkingMemory ────────────────────────────────

    describe("updateWorkingMemory()", () => {
        it("returns a new state with updates applied", () => {
            const original = createWorkingMemory("t1", "tenant-1", "task");
            const updated = updateWorkingMemory(original, {
                currentGoal: "New goal",
            });
            expect(updated.currentGoal).toBe("New goal");
            expect(updated.taskId).toBe("t1");
        });

        it("is immutable — does not mutate the input", () => {
            const original = createWorkingMemory("t1", "tenant-1", "task");
            const originalGoal = original.currentGoal;
            updateWorkingMemory(original, { currentGoal: "Changed" });
            expect(original.currentGoal).toBe(originalGoal);
        });

        it("updates currentTokenEstimate after modification", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "task");
            const updated = updateWorkingMemory(wm, {
                currentGoal: "A very important goal for the agent to pursue",
            });
            expect(updated.currentTokenEstimate).toBeGreaterThan(0);
        });
    });

    // ── Isolation ──────────────────────────────────────────

    describe("isolation between agents", () => {
        it("two separate WM instances do not share state", () => {
            const wm1 = createWorkingMemory("task-1", "t-a", "Task A");
            const wm2 = createWorkingMemory("task-2", "t-b", "Task B");

            const updated1 = updateWorkingMemory(wm1, {
                currentGoal: "Goal A",
            });
            const updated2 = updateWorkingMemory(wm2, {
                currentGoal: "Goal B",
            });

            expect(updated1.currentGoal).toBe("Goal A");
            expect(updated2.currentGoal).toBe("Goal B");
            expect(updated1.taskId).not.toBe(updated2.taskId);
            expect(updated1.tenantId).not.toBe(updated2.tenantId);
        });
    });

    // ── clearWorkingMemory ─────────────────────────────────

    describe("clearWorkingMemory()", () => {
        it("returns a blank state", () => {
            const cleared = clearWorkingMemory();
            expect(cleared.taskDescription).toBe("");
            expect(cleared.currentGoal).toBe("");
            expect(cleared.activePlanSteps).toEqual([]);
            expect(cleared.recentToolResults).toEqual([]);
            expect(cleared.mcpCallResults).toEqual([]);
            expect(cleared.ragResults).toEqual([]);
            expect(cleared.interAgentMessages).toEqual([]);
        });
    });

    // ── estimateTokens ─────────────────────────────────────

    describe("estimateTokens()", () => {
        it("returns a reasonable positive estimate", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "task");
            const estimate = estimateTokens(wm);
            expect(estimate).toBeGreaterThan(0);
            expect(typeof estimate).toBe("number");
        });

        it("increases when more data is added", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "task");
            const baseEstimate = estimateTokens(wm);

            const updated = updateWorkingMemory(wm, {
                recentToolResults: [
                    {
                        toolName: "search",
                        input: "query",
                        output: "A very long result string ".repeat(100),
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
            const updatedEstimate = estimateTokens(updated);
            expect(updatedEstimate).toBeGreaterThan(baseEstimate);
        });
    });

    // ── enforceTokenBudget ─────────────────────────────────

    describe("enforceTokenBudget()", () => {
        it("returns state unchanged when under budget", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "task");
            const enforced = enforceTokenBudget(wm);
            expect(enforced.recentToolResults).toEqual(
                wm.recentToolResults
            );
        });

        it("trims oldest recentToolResults first when over budget", () => {
            let wm = createWorkingMemory("t1", "tenant-1", "task");
            // Set very low budget
            wm = { ...wm, maxTokenBudget: 50 };

            // Add many tool results
            const results: ToolResult[] = Array.from(
                { length: 20 },
                (_, i) => ({
                    toolName: `tool-${i}`,
                    input: `input-${i}`,
                    output: "x".repeat(100),
                    timestamp: new Date().toISOString(),
                })
            );
            wm = { ...wm, recentToolResults: results };

            const enforced = enforceTokenBudget(wm);
            // Should have fewer tool results after trimming
            expect(enforced.recentToolResults.length).toBeLessThan(
                results.length
            );
        });

        it("preserves state when under budget", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "small");
            const enforced = enforceTokenBudget(wm);
            expect(enforced.taskId).toBe(wm.taskId);
            expect(enforced.tenantId).toBe(wm.tenantId);
        });
    });

    // ── Read/write fields ──────────────────────────────────

    describe("read/write individual fields", () => {
        it("can update activePlanSteps", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "task");
            const updated = updateWorkingMemory(wm, {
                activePlanSteps: [
                    {
                        id: "step-1",
                        description: "Step 1",
                        status: "pending",
                    },
                ],
            });
            expect(updated.activePlanSteps).toHaveLength(1);
            expect(updated.activePlanSteps[0].id).toBe("step-1");
        });

        it("can update interAgentMessages", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "task");
            const updated = updateWorkingMemory(wm, {
                interAgentMessages: [
                    {
                        fromAgent: "ideation",
                        toAgent: "planning",
                        content: "Here is the concept",
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
            expect(updated.interAgentMessages).toHaveLength(1);
            expect(updated.interAgentMessages[0].fromAgent).toBe("ideation");
        });

        it("can update loadedSkillDefinitions", () => {
            const wm = createWorkingMemory("t1", "tenant-1", "task");
            const updated = updateWorkingMemory(wm, {
                loadedSkillDefinitions: ["skill-a", "skill-b"],
            });
            expect(updated.loadedSkillDefinitions).toEqual([
                "skill-a",
                "skill-b",
            ]);
        });
    });
});
