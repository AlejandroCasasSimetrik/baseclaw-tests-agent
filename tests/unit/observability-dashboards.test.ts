import { describe, it, expect } from "vitest";
import {
    ALL_DASHBOARDS,
    CONVERSATION_DASHBOARD,
    IDEATION_DASHBOARD,
    PLANNING_DASHBOARD,
    EXECUTION_DASHBOARD,
    REVIEWER_DASHBOARD,
    SYSTEM_OVERVIEW_DASHBOARD,
    getDashboardForAgent,
    setupDashboards,
} from "baseclaw-agent/src/observability/dashboards.js";

describe("Dashboard Configuration (Level 4)", () => {
    // ── All 6 dashboards exist ──────────────────────────────

    it("defines exactly 6 dashboards", () => {
        expect(ALL_DASHBOARDS).toHaveLength(6);
    });

    it("includes dashboard for each agent type", () => {
        const agentTypes = ALL_DASHBOARDS
            .map((d) => d.agentType)
            .filter((t) => t !== null);
        expect(agentTypes).toContain("conversation");
        expect(agentTypes).toContain("ideation");
        expect(agentTypes).toContain("planning");
        expect(agentTypes).toContain("execution");
        expect(agentTypes).toContain("reviewer");
    });

    it("includes System Overview dashboard", () => {
        const systemDashboard = ALL_DASHBOARDS.find((d) => d.id === "dashboard-system-overview");
        expect(systemDashboard).toBeDefined();
        expect(systemDashboard!.agentType).toBeNull();
    });

    // ── Per-agent dashboard metrics ─────────────────────────

    it("Conversation dashboard has correct metrics", () => {
        const metrics = CONVERSATION_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("input_count");
        expect(metrics).toContain("routing_decisions");
        expect(metrics).toContain("avg_response_time");
        expect(metrics).toContain("error_rate");
    });

    it("Ideation dashboard has correct metrics", () => {
        const metrics = IDEATION_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("questions_generated");
        expect(metrics).toContain("rag_queries");
        expect(metrics).toContain("avg_session_length");
    });

    it("Planning dashboard has correct metrics", () => {
        const metrics = PLANNING_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("plans_created");
        expect(metrics).toContain("revisions_per_plan");
        expect(metrics).toContain("dependency_depth");
    });

    it("Execution dashboard has correct metrics", () => {
        const metrics = EXECUTION_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("tasks_executed");
        expect(metrics).toContain("tool_calls");
        expect(metrics).toContain("error_recovery");
    });

    it("Reviewer dashboard has correct metrics", () => {
        const metrics = REVIEWER_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("reviews_completed");
        expect(metrics).toContain("feedback_loops");
        expect(metrics).toContain("hitl_triggers");
        expect(metrics).toContain("quality_score");
        // Level 9 — HITL metrics
        expect(metrics).toContain("hitl_reasons_distribution");
        expect(metrics).toContain("avg_hitl_resolution_time");
    });

    // ── System Overview metrics ─────────────────────────────

    it("System Overview has latency percentiles", () => {
        const metrics = SYSTEM_OVERVIEW_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("latency_p50");
        expect(metrics).toContain("latency_p95");
        expect(metrics).toContain("latency_p99");
    });

    it("System Overview has global metrics", () => {
        const metrics = SYSTEM_OVERVIEW_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("total_traces");
        expect(metrics).toContain("total_cost");
        expect(metrics).toContain("total_tokens");
        expect(metrics).toContain("error_rate");
    });

    // ── Level 9 — Heartbeat & HITL metrics ──────────────────

    it("System Overview has heartbeat metrics", () => {
        const metrics = SYSTEM_OVERVIEW_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("heartbeat_fire_count");
        expect(metrics).toContain("tasks_auto_executed");
        expect(metrics).toContain("avg_idle_time");
    });

    it("System Overview has HITL metrics", () => {
        const metrics = SYSTEM_OVERVIEW_DASHBOARD.metrics.map((m) => m.key);
        expect(metrics).toContain("hitl_trigger_count");
        expect(metrics).toContain("avg_hitl_pause_duration");
    });

    it("Reviewer dashboard description mentions HITL", () => {
        expect(REVIEWER_DASHBOARD.description).toContain("HITL");
    });

    it("System Overview description mentions heartbeat", () => {
        expect(SYSTEM_OVERVIEW_DASHBOARD.description).toContain("heartbeat");
    });

    // ── getDashboardForAgent ────────────────────────────────

    it("returns correct dashboard for agent type", () => {
        const dashboard = getDashboardForAgent("conversation");
        expect(dashboard).toBeDefined();
        expect(dashboard!.id).toBe("dashboard-conversation");
    });

    it("returns undefined for non-existent agent type", () => {
        const dashboard = getDashboardForAgent("nonexistent" as any);
        expect(dashboard).toBeUndefined();
    });

    // ── setupDashboards ─────────────────────────────────────

    it("sets up all dashboards without errors", async () => {
        const result = await setupDashboards();

        expect(result.created).toHaveLength(6);
        expect(result.errors).toHaveLength(0);
    });

    // ── MetricDefinition structure ──────────────────────────

    it("every metric has key, label, and type", () => {
        for (const dashboard of ALL_DASHBOARDS) {
            for (const metric of dashboard.metrics) {
                expect(metric.key).toBeTruthy();
                expect(metric.label).toBeTruthy();
                expect(metric.type).toBeTruthy();
            }
        }
    });
});
