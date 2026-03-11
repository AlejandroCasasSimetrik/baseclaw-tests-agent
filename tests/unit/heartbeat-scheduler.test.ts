/**
 * Level 9 — Heartbeat Scheduler Tests
 *
 * Tests for the heartbeat scheduler: configuration, start/stop,
 * fire logic, state-based decisions, enable/disable, and health monitoring.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    HeartbeatScheduler,
    resetHeartbeatScheduler,
} from "baseclaw-agent/src/heartbeat/scheduler.js";
import { resetActiveInvocations, incrementActiveInvocations } from "baseclaw-agent/src/heartbeat/state-detector.js";
import { resetHITLManager, getHITLManager } from "baseclaw-agent/src/hitl/pause-resume.js";
import { resetSubAgentRegistry, getSubAgentRegistry } from "baseclaw-agent/src/subagent/registry.js";
import type { SubAgentState } from "baseclaw-agent/src/subagent/types.js";

describe("Level 9 — Heartbeat Scheduler", () => {
    let scheduler: HeartbeatScheduler;

    beforeEach(() => {
        resetHeartbeatScheduler();
        resetActiveInvocations();
        resetHITLManager();
        resetSubAgentRegistry();
        scheduler = new HeartbeatScheduler("test-tenant");
        scheduler.setConfig({ enabled: true, intervalMs: 60000, maxTaskDurationMs: 30000 });
    });

    afterEach(async () => {
        await scheduler.stop();
        resetHeartbeatScheduler();
        resetActiveInvocations();
        resetHITLManager();
        resetSubAgentRegistry();
    });

    describe("Configuration", () => {
        it("loads default config", () => {
            const config = scheduler.getConfig();
            expect(config.enabled).toBe(true);
            expect(config.intervalMs).toBe(60000);
            expect(config.maxTaskDurationMs).toBe(30000);
        });

        it("allows config override", () => {
            scheduler.setConfig({ intervalMs: 5000 });
            expect(scheduler.getConfig().intervalMs).toBe(5000);
        });
    });

    describe("Lifecycle", () => {
        it("starts and stops", () => {
            scheduler.start();
            expect(scheduler.isRunning()).toBe(true);

            scheduler.stop();
            expect(scheduler.isRunning()).toBe(false);
        });

        it("does not start if disabled", () => {
            scheduler.setConfig({ enabled: false });
            scheduler.start();
            expect(scheduler.isRunning()).toBe(false);
        });

        it("tracks fire count", async () => {
            expect(scheduler.getFireCount()).toBe(0);

            // Fire directly (bypasses interval)
            await scheduler.fire();
            expect(scheduler.getFireCount()).toBe(1);

            await scheduler.fire();
            expect(scheduler.getFireCount()).toBe(2);
        });

        it("tracks last fire time", async () => {
            expect(scheduler.getLastFireTime()).toBeNull();

            const before = Date.now();
            await scheduler.fire();
            const after = Date.now();

            const lastFire = scheduler.getLastFireTime();
            expect(lastFire).not.toBeNull();
            expect(lastFire!).toBeGreaterThanOrEqual(before);
            expect(lastFire!).toBeLessThanOrEqual(after);
        });
    });

    describe("Fire — State Detection", () => {
        it("returns 'idle' + 'continue' when no tasks and no activity", async () => {
            // No task manager DB connection → getNextTask will fail
            // but fire() degrades gracefully
            const decision = await scheduler.fire();
            expect(decision.state).toBe("idle");
            // Since no DB, it should see idle but no tasks
            expect(decision.action).toBe("continue");
            expect(decision.reason).toContain("idle");
        });

        it("returns 'executing' when main agent is active", async () => {
            incrementActiveInvocations();
            const decision = await scheduler.fire();
            expect(decision.state).toBe("executing");
            expect(decision.action).toBe("continue");
            expect(decision.reason).toContain("executing");
        });

        it("returns 'executing' when sub-agents are active", async () => {
            const registry = getSubAgentRegistry();
            registry.register({
                id: "sa-1",
                parentAgentId: "parent-1",
                agentType: "ideation",
                status: "running",
                task: "Test",
                tenantId: "test",
                inheritedSkillIds: [],
                inheritedMCPServerIds: [],
                ownMCPServerIds: [],
                traceId: "t-1",
                parentTraceId: "t-parent",
                workingMemory: null,
                spawnedAt: new Date().toISOString(),
            } as SubAgentState);

            const decision = await scheduler.fire();
            expect(decision.state).toBe("executing");
            expect(decision.action).toBe("continue");
        });

        it("returns 'waiting' when blocking HITL is pending", async () => {
            const hitlManager = getHITLManager();
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

            const decision = await scheduler.fire();
            expect(decision.state).toBe("waiting");
            expect(decision.action).toBe("wait");
            expect(decision.reason).toContain("HITL");
        });

        it("does NOT wait for non-blocking HITL notification", async () => {
            const hitlManager = getHITLManager();
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

            const decision = await scheduler.fire();
            // Should be idle (not waiting), since the notification is non-blocking
            expect(decision.state).toBe("idle");
            expect(decision.action).not.toBe("wait");
        });
    });

    describe("Graph invoke", () => {
        it("has no graph invoke by default", () => {
            // When no graph invoke is set, fire should still work
            // but not execute tasks
            expect(scheduler.getTasksExecuted()).toBe(0);
        });

        it("accepts graph invoke setter", () => {
            const mockInvoke = async () => ({ messages: [] });
            scheduler.setGraphInvoke(mockInvoke);
            // Should not throw
        });
    });

    describe("Enable/Disable toggle", () => {
        it("does not fire when disabled", () => {
            scheduler.setConfig({ enabled: false });
            scheduler.start();
            expect(scheduler.isRunning()).toBe(false);
        });

        it("can be re-enabled", () => {
            scheduler.setConfig({ enabled: false });
            scheduler.start();
            expect(scheduler.isRunning()).toBe(false);

            scheduler.setConfig({ enabled: true });
            scheduler.start();
            expect(scheduler.isRunning()).toBe(true);
        });
    });
});
