/**
 * Level 9 — Continuous Task Manager Tests
 *
 * Tests for the ContinuousTaskManager CRUD operations.
 * Requires a real PostgreSQL connection via DATABASE_URL.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ContinuousTaskManager } from "baseclaw-agent/src/heartbeat/task-manager.js";
import { getDb } from "baseclaw-agent/src/memory/episodic/db.js";
import { continuousTasks } from "baseclaw-agent/src/memory/episodic/schema.js";
import { eq } from "drizzle-orm";

const TEST_TENANT = `test-tenant-${Date.now()}`;

describe("Level 9 — Continuous Task Manager", () => {
    let manager: ContinuousTaskManager;

    beforeEach(async () => {
        manager = new ContinuousTaskManager(TEST_TENANT);
    });

    afterEach(async () => {
        // Clean up test data
        try {
            const db = getDb();
            await db
                .delete(continuousTasks)
                .where(eq(continuousTasks.tenantId, TEST_TENANT));
        } catch {
            // DB might not be available — that's OK
        }
    });

    describe("addTask", () => {
        it("creates a task with default values", async () => {
            const task = await manager.addTask({
                title: "Review code quality",
                description: "Run quality analysis on recent changes",
            });

            expect(task.id).toBeTruthy();
            expect(task.title).toBe("Review code quality");
            expect(task.description).toBe("Run quality analysis on recent changes");
            expect(task.status).toBe("queued");
            expect(task.assignedAgent).toBe("auto");
            expect(task.tenantId).toBe(TEST_TENANT);
            expect(task.result).toBeNull();
        });

        it("creates a task with custom priority and agent", async () => {
            const task = await manager.addTask({
                title: "Check dashboards",
                description: "Review system metrics",
                priority: 1,
                assignedAgent: "execution",
            });

            expect(task.priority).toBe(1);
            expect(task.assignedAgent).toBe("execution");
        });

        it("auto-assigns priority if not specified", async () => {
            const task1 = await manager.addTask({
                title: "Task 1",
                description: "First",
                priority: 5,
            });
            const task2 = await manager.addTask({
                title: "Task 2",
                description: "Second",
            });

            // Task 2 should get a higher priority number (lower priority)
            expect(task2.priority).toBeGreaterThan(task1.priority);
        });
    });

    describe("getTaskList", () => {
        it("returns empty list when no tasks exist", async () => {
            const tasks = await manager.getTaskList();
            expect(tasks).toHaveLength(0);
        });

        it("returns tasks ordered by priority", async () => {
            await manager.addTask({ title: "Low", description: "Low priority", priority: 10 });
            await manager.addTask({ title: "High", description: "High priority", priority: 1 });
            await manager.addTask({ title: "Medium", description: "Medium priority", priority: 5 });

            const tasks = await manager.getTaskList();
            expect(tasks).toHaveLength(3);
            expect(tasks[0].title).toBe("High");
            expect(tasks[1].title).toBe("Medium");
            expect(tasks[2].title).toBe("Low");
        });
    });

    describe("getNextTask", () => {
        it("returns null when no queued tasks", async () => {
            const next = await manager.getNextTask();
            expect(next).toBeNull();
        });

        it("returns highest-priority queued task", async () => {
            await manager.addTask({ title: "Low", description: "L", priority: 10 });
            await manager.addTask({ title: "High", description: "H", priority: 1 });

            const next = await manager.getNextTask();
            expect(next?.title).toBe("High");
        });

        it("skips in_progress tasks", async () => {
            const task1 = await manager.addTask({ title: "First", description: "F", priority: 1 });
            await manager.addTask({ title: "Second", description: "S", priority: 2 });

            await manager.markInProgress(task1.id);

            const next = await manager.getNextTask();
            expect(next?.title).toBe("Second");
        });
    });

    describe("updateTask", () => {
        it("updates task fields", async () => {
            const task = await manager.addTask({ title: "Original", description: "Desc" });

            const updated = await manager.updateTask(task.id, {
                title: "Updated",
                description: "New desc",
                priority: 1,
            });

            expect(updated?.title).toBe("Updated");
            expect(updated?.description).toBe("New desc");
            expect(updated?.priority).toBe(1);
        });

        it("returns null for non-existent task", async () => {
            const result = await manager.updateTask("00000000-0000-0000-0000-000000000000", { title: "X" });
            expect(result).toBeNull();
        });
    });

    describe("removeTask", () => {
        it("removes an existing task", async () => {
            const task = await manager.addTask({ title: "To Remove", description: "R" });
            expect(await manager.getTask(task.id)).toBeTruthy();

            const removed = await manager.removeTask(task.id);
            expect(removed).toBe(true);
            expect(await manager.getTask(task.id)).toBeNull();
        });

        it("returns false for non-existent task", async () => {
            const removed = await manager.removeTask("00000000-0000-0000-0000-000000000000");
            expect(removed).toBe(false);
        });
    });

    describe("Status transitions", () => {
        it("queued → in_progress", async () => {
            const task = await manager.addTask({ title: "Test", description: "T" });
            await manager.markInProgress(task.id);

            const updated = await manager.getTask(task.id);
            expect(updated?.status).toBe("in_progress");
        });

        it("in_progress → completed", async () => {
            const task = await manager.addTask({ title: "Test", description: "T" });
            await manager.markInProgress(task.id);
            await manager.markCompleted(task.id, "Done successfully", "trace-1");

            const updated = await manager.getTask(task.id);
            expect(updated?.status).toBe("completed");
            expect(updated?.result).toBe("Done successfully");
            expect(updated?.langsmithTraceId).toBe("trace-1");
            expect(updated?.completedAt).toBeTruthy();
        });

        it("in_progress → failed", async () => {
            const task = await manager.addTask({ title: "Test", description: "T" });
            await manager.markInProgress(task.id);
            await manager.markFailed(task.id, "Something broke", "trace-2");

            const updated = await manager.getTask(task.id);
            expect(updated?.status).toBe("failed");
            expect(updated?.result).toContain("ERROR:");
            expect(updated?.result).toContain("Something broke");
            expect(updated?.langsmithTraceId).toBe("trace-2");
        });
    });

    describe("reorderTasks", () => {
        it("reorders tasks by priority", async () => {
            const t1 = await manager.addTask({ title: "A", description: "A", priority: 1 });
            const t2 = await manager.addTask({ title: "B", description: "B", priority: 2 });
            const t3 = await manager.addTask({ title: "C", description: "C", priority: 3 });

            // Reorder: C first, then A, then B
            await manager.reorderTasks([t3.id, t1.id, t2.id]);

            const tasks = await manager.getTaskList();
            expect(tasks[0].title).toBe("C");
            expect(tasks[0].priority).toBe(1);
            expect(tasks[1].title).toBe("A");
            expect(tasks[1].priority).toBe(2);
            expect(tasks[2].title).toBe("B");
            expect(tasks[2].priority).toBe(3);
        });
    });

    describe("Tenant isolation", () => {
        it("tasks are scoped by tenant", async () => {
            await manager.addTask({ title: "Tenant task", description: "Scoped" });

            const otherManager = new ContinuousTaskManager("other-tenant");
            const otherTasks = await otherManager.getTaskList();
            expect(otherTasks).toHaveLength(0);
        });
    });
});
