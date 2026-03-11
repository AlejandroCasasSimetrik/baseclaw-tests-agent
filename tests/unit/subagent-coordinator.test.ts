/**
 * Level 8 — Sub-agent Coordinator Tests
 *
 * Tests for parallel execution coordination:
 *   - Queue management
 *   - Result collection patterns
 *   - Concurrency limiting
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubAgentQueue } from "baseclaw-agent/src/subagent/coordinator.js";
import {
    SubAgentRegistry,
    resetSubAgentRegistry,
} from "baseclaw-agent/src/subagent/registry.js";
import type { SubAgentState, SubAgentResult, SubAgentConfig } from "baseclaw-agent/src/subagent/types.js";

// ── Helpers ──────────────────────────────────────────────

function makeConfig(overrides: Partial<SubAgentConfig> = {}): SubAgentConfig {
    return {
        task: "Test task",
        parentAgentId: "parent-1",
        parentAgentType: "ideation",
        tenantId: "tenant-test",
        parentSkillIds: [],
        parentTraceId: "trace-1",
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
        executionSummary: "Completed",
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
        parentTraceId: "trace-1",
        workingMemory: null,
        spawnedAt: new Date().toISOString(),
        ...overrides,
    };
}

describe("Level 8 — Sub-agent Coordinator", () => {
    describe("SubAgentQueue", () => {
        let queue: SubAgentQueue;

        beforeEach(() => {
            queue = new SubAgentQueue(3);
        });

        afterEach(() => {
            // Dequeue and resolve any pending requests before clearing
            // to avoid unhandled rejections
            let pending = queue.dequeue("parent-1");
            while (pending) {
                pending.resolve("cleanup");
                pending = queue.dequeue("parent-1");
            }
            pending = queue.dequeue("parent-2");
            while (pending) {
                pending.resolve("cleanup");
                pending = queue.dequeue("parent-2");
            }
            queue.clear();
        });

        it("initializes with a configurable concurrency limit", () => {
            expect(queue.limit).toBe(3);
        });

        it("shouldQueue returns false when below limit", () => {
            expect(queue.shouldQueue(0)).toBe(false);
            expect(queue.shouldQueue(2)).toBe(false);
        });

        it("shouldQueue returns true when at limit", () => {
            expect(queue.shouldQueue(3)).toBe(true);
            expect(queue.shouldQueue(5)).toBe(true);
        });

        it("enqueues and dequeues spawn requests", async () => {
            const config = makeConfig();
            const promise = queue.enqueue("parent-1", config);

            expect(queue.getQueueLength("parent-1")).toBe(1);

            const dequeued = queue.dequeue("parent-1");
            expect(dequeued).toBeDefined();
            expect(dequeued?.config.task).toBe("Test task");

            // Resolve the dequeued promise
            dequeued?.resolve("spawned-id");
            const id = await promise;
            expect(id).toBe("spawned-id");
        });

        it("maintains FIFO order", async () => {
            queue.enqueue("parent-1", makeConfig({ task: "Task 1" }));
            queue.enqueue("parent-1", makeConfig({ task: "Task 2" }));
            queue.enqueue("parent-1", makeConfig({ task: "Task 3" }));

            expect(queue.getQueueLength("parent-1")).toBe(3);

            const first = queue.dequeue("parent-1");
            expect(first?.config.task).toBe("Task 1");

            const second = queue.dequeue("parent-1");
            expect(second?.config.task).toBe("Task 2");

            first?.resolve("id-1");
            second?.resolve("id-2");
        });

        it("dequeue returns undefined when queue is empty", () => {
            expect(queue.dequeue("parent-1")).toBeUndefined();
        });

        it("tracks total queue length across parents", () => {
            queue.enqueue("parent-1", makeConfig());
            queue.enqueue("parent-1", makeConfig());
            queue.enqueue("parent-2", makeConfig());

            expect(queue.getTotalQueueLength()).toBe(3);
        });

        it("cancels all queued requests for a parent", async () => {
            const p1 = queue.enqueue("parent-1", makeConfig());
            const p2 = queue.enqueue("parent-1", makeConfig());

            queue.cancelParentQueue("parent-1");

            expect(queue.getQueueLength("parent-1")).toBe(0);

            // Both promises should reject
            await expect(p1).rejects.toThrow("cancelled");
            await expect(p2).rejects.toThrow("cancelled");
        });

        it("setLimit updates the concurrency limit", () => {
            queue.setLimit(10);
            expect(queue.limit).toBe(10);
        });

        it("setLimit enforces minimum of 1", () => {
            queue.setLimit(0);
            expect(queue.limit).toBe(1);

            queue.setLimit(-5);
            expect(queue.limit).toBe(1);
        });
    });

    describe("Result Collection with Registry", () => {
        let registry: SubAgentRegistry;

        beforeEach(() => {
            registry = new SubAgentRegistry();
        });

        afterEach(() => {
            registry.clear();
        });

        it("collects results from already-completed sub-agents", async () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "p1" }));
            registry.register(makeSubAgentState({ id: "sa-2", parentAgentId: "p1" }));

            registry.markCompleted("sa-1", makeResult({ output: "Out 1" }));
            registry.markCompleted("sa-2", makeResult({ output: "Out 2" }));

            const results = await registry.awaitAllSubAgents("p1");
            expect(results).toHaveLength(2);
        });

        it("returns null for failed sub-agents in batch collection", async () => {
            registry.register(makeSubAgentState({ id: "sa-1", parentAgentId: "p1" }));
            registry.register(makeSubAgentState({ id: "sa-2", parentAgentId: "p1" }));

            registry.markCompleted("sa-1", makeResult());
            registry.markFailed("sa-2", "Failed!");

            const results = await registry.awaitAllSubAgents("p1");
            expect(results).toHaveLength(2);
            expect(results[0]).toBeDefined(); // sa-1 completed
            expect(results[1]).toBeNull(); // sa-2 failed
        });
    });
});
