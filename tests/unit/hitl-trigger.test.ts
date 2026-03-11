/**
 * Level 9 — HITL Trigger Tests
 *
 * Tests ownership enforcement: only Reviewer Agent can trigger HITL.
 * Uses real HITLManager instances.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { triggerHITL } from "baseclaw-agent/src/hitl/trigger.js";
import { HITLOwnershipError } from "baseclaw-agent/src/hitl/types.js";
import { getHITLManager, resetHITLManager } from "baseclaw-agent/src/hitl/pause-resume.js";

describe("Level 9 — HITL Trigger", () => {
    beforeEach(() => {
        resetHITLManager();
    });

    afterEach(() => {
        resetHITLManager();
    });

    describe("Reviewer-only enforcement", () => {
        it("allows Reviewer Agent to trigger HITL", async () => {
            const request = await triggerHITL(
                "Quality below threshold",
                { score: 0.3 },
                "reviewer",
                "tenant-1"
            );

            expect(request).toBeDefined();
            expect(request.reason).toBe("Quality below threshold");
            expect(request.triggeredBy).toBe("reviewer");
            expect(request.blocking).toBe(true);
            expect(request.tenantId).toBe("tenant-1");
            expect(request.id).toBeTruthy();
        });

        it("rejects Conversation Agent", async () => {
            await expect(
                triggerHITL("Test", {}, "conversation", "tenant-1")
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects Ideation Agent", async () => {
            await expect(
                triggerHITL("Test", {}, "ideation", "tenant-1")
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects Planning Agent", async () => {
            await expect(
                triggerHITL("Test", {}, "planning", "tenant-1")
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects Execution Agent", async () => {
            await expect(
                triggerHITL("Test", {}, "execution", "tenant-1")
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects sub-agents", async () => {
            await expect(
                triggerHITL("Test", {}, "sub-agent-ideation", "tenant-1")
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects unknown callers", async () => {
            await expect(
                triggerHITL("Test", {}, "unknown-agent", "tenant-1")
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("error message includes the caller agent name", async () => {
            try {
                await triggerHITL("Test", {}, "execution", "tenant-1");
            } catch (error) {
                expect((error as Error).message).toContain("execution");
            }
        });
    });

    describe("HITL Request creation", () => {
        it("creates request with options", async () => {
            const options = [
                { label: "Approve", value: "approve" },
                { label: "Reject", value: "reject" },
            ];
            const request = await triggerHITL(
                "Needs approval",
                { output: "test" },
                "reviewer",
                "tenant-1",
                options
            );

            expect(request.options).toHaveLength(2);
            expect(request.options![0].label).toBe("Approve");
        });

        it("creates request without options (open-ended)", async () => {
            const request = await triggerHITL(
                "Needs guidance",
                { ambiguity: "unclear direction" },
                "reviewer",
                "tenant-1"
            );

            expect(request.options).toBeNull();
        });

        it("sets the HITL state to pending", async () => {
            const manager = getHITLManager();
            expect(manager.isPending()).toBe(false);

            await triggerHITL("Test", {}, "reviewer", "tenant-1");

            expect(manager.isPending()).toBe(true);
        });

        it("stores the request in the manager", async () => {
            await triggerHITL("Test reason", { data: "test" }, "reviewer", "tenant-1");

            const manager = getHITLManager();
            const request = manager.getCurrentRequest();
            expect(request).toBeDefined();
            expect(request?.reason).toBe("Test reason");
        });

        it("prevents double-triggering", async () => {
            await triggerHITL("First", {}, "reviewer", "tenant-1");

            await expect(
                triggerHITL("Second", {}, "reviewer", "tenant-1")
            ).rejects.toThrow("HITL is already pending");
        });

        it("generates unique IDs", async () => {
            const req1 = await triggerHITL("Test 1", {}, "reviewer", "tenant-1");
            resetHITLManager();
            const req2 = await triggerHITL("Test 2", {}, "reviewer", "tenant-1");

            expect(req1.id).not.toBe(req2.id);
        });

        it("generates langsmith trace ID", async () => {
            const request = await triggerHITL("Test", {}, "reviewer", "tenant-1");
            expect(request.langsmithTraceId).toBeTruthy();
            expect(request.langsmithTraceId).toContain("hitl-");
        });
    });

    describe("Blocking vs Non-Blocking", () => {
        it("defaults to blocking when not specified", async () => {
            const request = await triggerHITL("Test", {}, "reviewer", "tenant-1");
            expect(request.blocking).toBe(true);

            const manager = getHITLManager();
            expect(manager.isPending()).toBe(true);
        });

        it("blocking: true pauses the system", async () => {
            await triggerHITL("Test", {}, "reviewer", "tenant-1", undefined, true);
            const manager = getHITLManager();
            expect(manager.isPending()).toBe(true);
            expect(manager.isBlocking()).toBe(true);
        });

        it("blocking: false does NOT pause the system", async () => {
            await triggerHITL("Task done", {}, "reviewer", "tenant-1", undefined, false);
            const manager = getHITLManager();
            expect(manager.isPending()).toBe(false);
            expect(manager.isBlocking()).toBe(false);
        });

        it("non-blocking stores a notification", async () => {
            await triggerHITL("Task done", {}, "reviewer", "tenant-1", undefined, false);
            const manager = getHITLManager();
            const notifications = manager.getNotifications();
            expect(notifications).toHaveLength(1);
            expect(notifications[0].reason).toBe("Task done");
        });

        it("allows multiple non-blocking triggers", async () => {
            await triggerHITL("First", {}, "reviewer", "tenant-1", undefined, false);
            await triggerHITL("Second", {}, "reviewer", "tenant-1", undefined, false);
            const manager = getHITLManager();
            expect(manager.getNotifications()).toHaveLength(2);
        });

        it("prevents double-trigger only for blocking", async () => {
            await triggerHITL("First", {}, "reviewer", "tenant-1", undefined, true);
            // Second blocking should fail
            await expect(
                triggerHITL("Second", {}, "reviewer", "tenant-1", undefined, true)
            ).rejects.toThrow("HITL is already pending");
            // But non-blocking should work
            const request = await triggerHITL("Notification", {}, "reviewer", "tenant-1", undefined, false);
            expect(request.blocking).toBe(false);
        });
    });
});
