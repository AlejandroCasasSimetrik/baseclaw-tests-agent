/**
 * Level 9 — Heartbeat & HITL Observability Tests
 *
 * Tests for LangSmith trace spans and dashboard metrics
 * related to Level 9 features.
 */

import { describe, it, expect } from "vitest";
import {
    traceHeartbeat,
    traceHITLTrigger,
    traceHITLResume,
} from "baseclaw-agent/src/observability/trace-metadata.js";
import {
    SYSTEM_OVERVIEW_DASHBOARD,
    REVIEWER_DASHBOARD,
} from "baseclaw-agent/src/observability/dashboards.js";

describe("Level 9 — Heartbeat & HITL Observability", () => {
    describe("Trace Spans", () => {
        it("traceHeartbeat returns sanitized data", async () => {
            const result = await traceHeartbeat({
                state: "idle",
                action: "pull_task",
                taskId: "task-1",
                taskTitle: "Review dashboards",
                routedToAgent: "execution",
                reason: "System idle — pulling next task",
                fireCount: 5,
                intervalMs: 1800000,
            });

            expect(result.systemState).toBe("idle");
            expect(result.action).toBe("pull_task");
            expect(result.taskId).toBe("task-1");
            expect(result.fireCount).toBe(5);
        });

        it("traceHITLTrigger returns sanitized data", async () => {
            const result = await traceHITLTrigger({
                reason: "Quality below threshold",
                triggeredBy: "reviewer",
                contextSummary: "Output scored 0.3/1.0",
                hasOptions: true,
                optionCount: 2,
                requestId: "req-1",
            });

            expect(result.reason).toBe("Quality below threshold");
            expect(result.triggeredBy).toBe("reviewer");
            expect(result.hasOptions).toBe(true);
        });

        it("traceHITLResume returns sanitized data", async () => {
            const result = await traceHITLResume({
                requestId: "req-1",
                userInput: "I approve this change",
                selectedOption: "approve",
                routedToAgent: "execution",
                pauseDurationMs: 45000,
            });

            expect(result.requestId).toBe("req-1");
            expect(result.pauseDurationMs).toBe(45000);
            expect(result.routedToAgent).toBe("execution");
        });

        it("traceHITLTrigger truncates long context", async () => {
            const longContext = "a".repeat(1000);
            const result = await traceHITLTrigger({
                reason: "Test",
                triggeredBy: "reviewer",
                contextSummary: longContext,
                hasOptions: false,
                optionCount: 0,
                requestId: "req-1",
            });

            expect(result.contextSummary!.length).toBeLessThanOrEqual(500);
        });
    });

    describe("Dashboard Metrics", () => {
        it("System Overview includes heartbeat metrics", () => {
            const metricKeys = SYSTEM_OVERVIEW_DASHBOARD.metrics.map(m => m.key);
            expect(metricKeys).toContain("heartbeat_fire_count");
            expect(metricKeys).toContain("tasks_auto_executed");
            expect(metricKeys).toContain("avg_idle_time");
        });

        it("System Overview includes HITL metrics", () => {
            const metricKeys = SYSTEM_OVERVIEW_DASHBOARD.metrics.map(m => m.key);
            expect(metricKeys).toContain("hitl_trigger_count");
            expect(metricKeys).toContain("avg_hitl_pause_duration");
        });

        it("Reviewer Dashboard includes HITL metrics", () => {
            const metricKeys = REVIEWER_DASHBOARD.metrics.map(m => m.key);
            expect(metricKeys).toContain("hitl_triggers");
            expect(metricKeys).toContain("hitl_reasons_distribution");
            expect(metricKeys).toContain("avg_hitl_resolution_time");
        });

        it("System Overview description mentions heartbeat", () => {
            expect(SYSTEM_OVERVIEW_DASHBOARD.description).toContain("heartbeat");
        });

        it("Reviewer description mentions HITL", () => {
            expect(REVIEWER_DASHBOARD.description).toContain("HITL");
        });
    });
});
