import { describe, it, expect, afterEach } from "vitest";
import {
    ALL_ALERT_RULES,
    ERROR_RATE_ALERT,
    LATENCY_P95_ALERT,
    COST_THRESHOLD_ALERT,
    HITL_TRIGGER_ALERT,
    getAlertDestination,
    getAlertConfig,
    setupAlerts,
} from "baseclaw-agent/src/observability/alerting.js";

describe("Alerting (Level 4)", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    // ── Alert Rules ─────────────────────────────────────────

    it("defines exactly 4 alert rules", () => {
        expect(ALL_ALERT_RULES).toHaveLength(4);
    });

    it("includes error rate alert", () => {
        expect(ERROR_RATE_ALERT.metric).toBe("error_rate");
        expect(ERROR_RATE_ALERT.threshold).toBe(5);
        expect(ERROR_RATE_ALERT.operator).toBe(">");
        expect(ERROR_RATE_ALERT.windowSeconds).toBe(300);
        expect(ERROR_RATE_ALERT.severity).toBe("critical");
    });

    it("includes p95 latency alert", () => {
        expect(LATENCY_P95_ALERT.metric).toBe("latency_p95");
        expect(LATENCY_P95_ALERT.threshold).toBe(10000);
        expect(LATENCY_P95_ALERT.severity).toBe("warning");
    });

    it("includes cost threshold alert", () => {
        expect(COST_THRESHOLD_ALERT.metric).toBe("cost_per_hour");
        expect(COST_THRESHOLD_ALERT.windowSeconds).toBe(3600);
    });

    it("includes HITL trigger alert (wired for future)", () => {
        expect(HITL_TRIGGER_ALERT.metric).toBe("hitl_trigger");
        expect(HITL_TRIGGER_ALERT.severity).toBe("critical");
        expect(HITL_TRIGGER_ALERT.enabled).toBe(true);
    });

    it("all alerts have required fields", () => {
        for (const rule of ALL_ALERT_RULES) {
            expect(rule.id).toBeTruthy();
            expect(rule.name).toBeTruthy();
            expect(rule.description).toBeTruthy();
            expect(rule.metric).toBeTruthy();
            expect(typeof rule.threshold).toBe("number");
            expect(rule.operator).toBeTruthy();
            expect(typeof rule.windowSeconds).toBe("number");
            expect(["info", "warning", "critical"]).toContain(rule.severity);
            expect(typeof rule.enabled).toBe("boolean");
        }
    });

    // ── Alert Destination ───────────────────────────────────

    it("returns null when no webhook URL configured", () => {
        delete process.env.LANGSMITH_ALERT_WEBHOOK_URL;
        expect(getAlertDestination()).toBeNull();
    });

    it("returns webhook destination when URL configured", () => {
        process.env.LANGSMITH_ALERT_WEBHOOK_URL = "https://hooks.slack.com/test";
        const dest = getAlertDestination();
        expect(dest).not.toBeNull();
        expect(dest!.type).toBe("webhook");
        expect(dest!.target).toBe("https://hooks.slack.com/test");
        expect(dest!.headers).toHaveProperty("Content-Type");
    });

    // ── Alert Config ────────────────────────────────────────

    it("getAlertConfig returns rules and destination", () => {
        process.env.LANGSMITH_ALERT_WEBHOOK_URL = "https://test.webhook.com";
        const config = getAlertConfig();
        expect(config.rules).toHaveLength(4);
        expect(config.destination).not.toBeNull();
    });

    // ── setupAlerts ─────────────────────────────────────────

    it("sets up alerts and returns configured rule IDs", async () => {
        const result = await setupAlerts();

        expect(result.configured).toHaveLength(4);
        expect(result.configured).toContain("alert-error-rate");
        expect(result.configured).toContain("alert-hitl-trigger");
    });
});
