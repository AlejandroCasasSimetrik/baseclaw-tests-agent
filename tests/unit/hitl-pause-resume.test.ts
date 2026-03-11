/**
 * Level 9 — HITL Pause/Resume Tests
 *
 * Tests for the HITLManager singleton: pause, resume,
 * state tracking, pause duration, and event emission.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    HITLManager,
    getHITLManager,
    resetHITLManager,
} from "baseclaw-agent/src/hitl/pause-resume.js";
import type { HITLRequest, HITLResponse } from "baseclaw-agent/src/hitl/types.js";

function makeRequest(overrides: Partial<HITLRequest> = {}): HITLRequest {
    return {
        id: "req-1",
        reason: "Test reason",
        context: { data: "test" },
        options: null,
        blocking: true,
        triggeredBy: "reviewer",
        tenantId: "tenant-1",
        createdAt: new Date().toISOString(),
        langsmithTraceId: "trace-1",
        ...overrides,
    };
}

function makeResponse(overrides: Partial<HITLResponse> = {}): HITLResponse {
    return {
        requestId: "req-1",
        userInput: "Approved",
        respondedAt: new Date().toISOString(),
        ...overrides,
    };
}

describe("Level 9 — HITL Pause/Resume", () => {
    let manager: HITLManager;

    beforeEach(() => {
        manager = new HITLManager();
    });

    afterEach(() => {
        manager.reset();
    });

    describe("Initial state", () => {
        it("starts in idle state", () => {
            expect(manager.getState()).toBe("idle");
            expect(manager.isPending()).toBe(false);
            expect(manager.isBlocking()).toBe(false);
            expect(manager.getCurrentRequest()).toBeNull();
            expect(manager.getPauseDuration()).toBeNull();
        });
    });

    describe("Pause", () => {
        it("sets state to pending", () => {
            manager.pause(makeRequest());
            expect(manager.getState()).toBe("pending");
            expect(manager.isPending()).toBe(true);
        });

        it("stores the current request", () => {
            const request = makeRequest({ id: "custom-id" });
            manager.pause(request);
            expect(manager.getCurrentRequest()?.id).toBe("custom-id");
        });

        it("starts tracking pause duration", () => {
            manager.pause(makeRequest());
            const duration = manager.getPauseDuration();
            expect(duration).not.toBeNull();
            expect(duration).toBeGreaterThanOrEqual(0);
        });

        it("emits 'paused' event", () => {
            let emitted = false;
            manager.on("paused", () => { emitted = true; });
            manager.pause(makeRequest());
            expect(emitted).toBe(true);
        });

        it("emits 'paused' event with request", () => {
            let receivedRequest: HITLRequest | null = null;
            manager.on("paused", (req: HITLRequest) => { receivedRequest = req; });
            const request = makeRequest({ reason: "Custom reason" });
            manager.pause(request);
            expect(receivedRequest?.reason).toBe("Custom reason");
        });
    });

    describe("Blocking vs Non-Blocking", () => {
        it("isBlocking returns true for blocking HITL", () => {
            manager.pause(makeRequest({ blocking: true }));
            expect(manager.isBlocking()).toBe(true);
        });

        it("isBlocking returns false for non-blocking notification", () => {
            // Non-blocking uses notify(), not pause()
            manager.notify(makeRequest({ blocking: false }));
            expect(manager.isBlocking()).toBe(false);
        });

        it("isBlocking returns false when idle", () => {
            expect(manager.isBlocking()).toBe(false);
        });

        it("notify does not set state to pending", () => {
            manager.notify(makeRequest({ blocking: false }));
            expect(manager.isPending()).toBe(false);
            expect(manager.getState()).toBe("idle");
        });

        it("notify stores notifications", () => {
            manager.notify(makeRequest({ id: "n-1", blocking: false }));
            manager.notify(makeRequest({ id: "n-2", blocking: false }));
            expect(manager.getNotifications()).toHaveLength(2);
        });

        it("notify emits 'notified' event", () => {
            let emitted = false;
            manager.on("notified", () => { emitted = true; });
            manager.notify(makeRequest({ blocking: false }));
            expect(emitted).toBe(true);
        });

        it("clearNotifications returns and clears notifications", () => {
            manager.notify(makeRequest({ id: "n-1", blocking: false }));
            manager.notify(makeRequest({ id: "n-2", blocking: false }));
            const cleared = manager.clearNotifications();
            expect(cleared).toHaveLength(2);
            expect(manager.getNotifications()).toHaveLength(0);
        });
    });

    describe("Resume", () => {
        it("clears the HITL state", () => {
            manager.pause(makeRequest());
            manager.resume(makeResponse());

            expect(manager.getState()).toBe("idle");
            expect(manager.isPending()).toBe(false);
            expect(manager.isBlocking()).toBe(false);
            expect(manager.getCurrentRequest()).toBeNull();
        });

        it("returns pause duration", () => {
            manager.pause(makeRequest());
            // Small delay to ensure non-zero duration
            const result = manager.resume(makeResponse());
            expect(result.pauseDurationMs).toBeGreaterThanOrEqual(0);
        });

        it("clears pause duration tracking", () => {
            manager.pause(makeRequest());
            manager.resume(makeResponse());
            expect(manager.getPauseDuration()).toBeNull();
        });

        it("emits 'resumed' event", () => {
            let emitted = false;
            manager.on("resumed", () => { emitted = true; });
            manager.pause(makeRequest());
            manager.resume(makeResponse());
            expect(emitted).toBe(true);
        });

        it("emits 'resumed' event with response and duration", () => {
            let receivedResponse: HITLResponse | null = null;
            let receivedDuration: number = 0;
            manager.on("resumed", (resp: HITLResponse, dur: number) => {
                receivedResponse = resp;
                receivedDuration = dur;
            });
            manager.pause(makeRequest());
            manager.resume(makeResponse({ userInput: "Custom input" }));
            expect(receivedResponse?.userInput).toBe("Custom input");
            expect(receivedDuration).toBeGreaterThanOrEqual(0);
        });
    });

    describe("Reset", () => {
        it("clears all state", () => {
            manager.pause(makeRequest());
            manager.notify(makeRequest({ id: "n-1", blocking: false }));
            manager.reset();
            expect(manager.getState()).toBe("idle");
            expect(manager.isPending()).toBe(false);
            expect(manager.isBlocking()).toBe(false);
            expect(manager.getCurrentRequest()).toBeNull();
            expect(manager.getPauseDuration()).toBeNull();
            expect(manager.getNotifications()).toHaveLength(0);
        });

        it("removes all event listeners", () => {
            let count = 0;
            manager.on("paused", () => count++);
            manager.reset();
            // After reset, listener should be gone
            manager.pause(makeRequest());
            expect(count).toBe(0);
        });
    });

    describe("Singleton", () => {
        afterEach(() => { resetHITLManager(); });

        it("returns same instance", () => {
            const m1 = getHITLManager();
            const m2 = getHITLManager();
            expect(m1).toBe(m2);
        });

        it("resetHITLManager creates new instance", () => {
            const m1 = getHITLManager();
            m1.pause(makeRequest());
            resetHITLManager();
            const m2 = getHITLManager();
            expect(m2.isPending()).toBe(false);
            expect(m1).not.toBe(m2);
        });
    });

    describe("Heartbeat integration — waiting state", () => {
        it("heartbeat detects waiting when blocking HITL pending", () => {
            manager.pause(makeRequest({ blocking: true }));
            expect(manager.isPending()).toBe(true);
            expect(manager.isBlocking()).toBe(true);
        });

        it("heartbeat does NOT wait for non-blocking notification", () => {
            manager.notify(makeRequest({ blocking: false }));
            expect(manager.isPending()).toBe(false);
            expect(manager.isBlocking()).toBe(false);
        });

        it("heartbeat detects idle after HITL resolved", () => {
            manager.pause(makeRequest());
            manager.resume(makeResponse());
            expect(manager.isPending()).toBe(false);
            expect(manager.isBlocking()).toBe(false);
        });
    });
});
