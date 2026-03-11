/**
 * Level 9 — Heartbeat Types Tests
 *
 * Tests for heartbeat type definitions and config loading.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadHeartbeatConfig } from "baseclaw-agent/src/heartbeat/types.js";
import type {
    SystemState,
    HeartbeatAction,
    HeartbeatConfig,
    HeartbeatDecision,
    ContinuousTask,
    TaskStatus,
} from "baseclaw-agent/src/heartbeat/types.js";

describe("Level 9 — Heartbeat Types", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe("loadHeartbeatConfig", () => {
        it("returns default config when no env vars set", () => {
            delete process.env.HEARTBEAT_INTERVAL_MS;
            delete process.env.HEARTBEAT_ENABLED;
            delete process.env.HEARTBEAT_MAX_TASK_DURATION_MS;

            const config = loadHeartbeatConfig();
            expect(config.intervalMs).toBe(300000);
            expect(config.enabled).toBe(true);
            expect(config.maxTaskDurationMs).toBe(3600000);
        });

        it("reads interval from env", () => {
            process.env.HEARTBEAT_INTERVAL_MS = "5000";
            const config = loadHeartbeatConfig();
            expect(config.intervalMs).toBe(5000);
        });

        it("reads enabled toggle from env", () => {
            process.env.HEARTBEAT_ENABLED = "false";
            const config = loadHeartbeatConfig();
            expect(config.enabled).toBe(false);
        });

        it("reads max task duration from env", () => {
            process.env.HEARTBEAT_MAX_TASK_DURATION_MS = "120000";
            const config = loadHeartbeatConfig();
            expect(config.maxTaskDurationMs).toBe(120000);
        });

        it("treats any non-false value as enabled", () => {
            process.env.HEARTBEAT_ENABLED = "true";
            expect(loadHeartbeatConfig().enabled).toBe(true);

            process.env.HEARTBEAT_ENABLED = "yes";
            expect(loadHeartbeatConfig().enabled).toBe(true);
        });
    });

    describe("Type shape validation", () => {
        it("SystemState has correct values", () => {
            const states: SystemState[] = ["executing", "idle", "waiting"];
            expect(states).toHaveLength(3);
        });

        it("HeartbeatAction has correct values", () => {
            const actions: HeartbeatAction[] = ["continue", "pull_task", "wait"];
            expect(actions).toHaveLength(3);
        });

        it("TaskStatus has correct values", () => {
            const statuses: TaskStatus[] = [
                "queued", "in_progress", "completed", "failed"
            ];
            expect(statuses).toHaveLength(4);
        });

        it("HeartbeatDecision has required fields", () => {
            const decision: HeartbeatDecision = {
                state: "idle",
                action: "pull_task",
                taskId: "task-1",
                taskTitle: "Test task",
                routedToAgent: "execution",
                reason: "Test reason",
                timestamp: new Date().toISOString(),
            };
            expect(decision.state).toBe("idle");
            expect(decision.action).toBe("pull_task");
            expect(decision.timestamp).toBeTruthy();
        });

        it("ContinuousTask has all required fields", () => {
            const task: ContinuousTask = {
                id: "test-id",
                tenantId: "tenant-1",
                title: "Test task",
                description: "Do something",
                priority: 1,
                status: "queued",
                assignedAgent: "auto",
                result: null,
                langsmithTraceId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                completedAt: null,
            };
            expect(task.id).toBe("test-id");
            expect(task.status).toBe("queued");
        });
    });
});
