/**
 * Level 9 — HITL Dialog Tests
 *
 * Tests for formatting HITL requests for user presentation
 * and processing user responses.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    formatHITLForUser,
    processHITLResponse,
} from "baseclaw-agent/src/hitl/dialog.js";
import { getHITLManager, resetHITLManager } from "baseclaw-agent/src/hitl/pause-resume.js";
import type { HITLRequest } from "baseclaw-agent/src/hitl/types.js";

function makeRequest(overrides: Partial<HITLRequest> = {}): HITLRequest {
    return {
        id: "req-1",
        reason: "Quality below threshold",
        context: { score: 0.3, output: "Test output" },
        options: null,
        blocking: true,
        triggeredBy: "reviewer",
        tenantId: "tenant-1",
        createdAt: new Date().toISOString(),
        langsmithTraceId: "trace-1",
        ...overrides,
    };
}

describe("Level 9 — HITL Dialog", () => {
    beforeEach(() => {
        resetHITLManager();
    });

    afterEach(() => {
        resetHITLManager();
    });

    describe("formatHITLForUser", () => {
        it("includes the reason", () => {
            const result = formatHITLForUser(makeRequest());
            expect(result.message).toContain("Quality below threshold");
        });

        it("includes context data", () => {
            const result = formatHITLForUser(makeRequest({
                context: { score: 0.3, recommendation: "Revise output" },
            }));
            expect(result.message).toContain("score");
            expect(result.message).toContain("recommendation");
        });

        it("includes 'System Paused' header", () => {
            const result = formatHITLForUser(makeRequest());
            expect(result.message).toContain("System Paused");
        });

        it("formats open-ended request (no options)", () => {
            const result = formatHITLForUser(makeRequest({ options: null }));
            expect(result.hasOptions).toBe(false);
            expect(result.options).toHaveLength(0);
            expect(result.message).toContain("provide your input");
        });

        it("formats structured options", () => {
            const result = formatHITLForUser(makeRequest({
                options: [
                    { label: "Approve", value: "approve", description: "Accept as-is" },
                    { label: "Reject", value: "reject", description: "Send back" },
                    { label: "Modify", value: "modify" },
                ],
            }));
            expect(result.hasOptions).toBe(true);
            expect(result.options).toHaveLength(3);
            expect(result.message).toContain("Approve");
            expect(result.message).toContain("Reject");
            expect(result.message).toContain("Modify");
            expect(result.message).toContain("Accept as-is");
        });

        it("handles empty context", () => {
            const result = formatHITLForUser(makeRequest({ context: {} }));
            expect(result.message).not.toContain("Context:");
        });
    });

    describe("processHITLResponse", () => {
        it("throws if no HITL is pending", async () => {
            await expect(
                processHITLResponse("test input")
            ).rejects.toThrow("No HITL request is pending");
        });

        it("processes user input and resumes system", async () => {
            const manager = getHITLManager();
            manager.pause(makeRequest());

            const result = await processHITLResponse("I approve this");

            expect(result.response.userInput).toBe("I approve this");
            expect(result.response.requestId).toBe("req-1");
            expect(result.pauseDurationMs).toBeGreaterThanOrEqual(0);
            expect(manager.isPending()).toBe(false);
        });

        it("includes selected option", async () => {
            const manager = getHITLManager();
            manager.pause(makeRequest());

            const result = await processHITLResponse("Approved", "approve");

            expect(result.response.selectedOption).toBe("approve");
        });

        it("includes route-to agent", async () => {
            const manager = getHITLManager();
            manager.pause(makeRequest());

            const result = await processHITLResponse("Fix this", undefined, "execution");

            expect(result.response.routeToAgent).toBe("execution");
        });

        it("defaults route-to to reviewer", async () => {
            const manager = getHITLManager();
            manager.pause(makeRequest());

            const result = await processHITLResponse("OK");

            expect(result.response.routeToAgent).toBe("reviewer");
        });

        it("sets respondedAt timestamp", async () => {
            const manager = getHITLManager();
            manager.pause(makeRequest());

            const result = await processHITLResponse("test");

            expect(result.response.respondedAt).toBeTruthy();
            // Timestamp should be recent (within last 5 seconds)
            const diff = Date.now() - new Date(result.response.respondedAt).getTime();
            expect(diff).toBeLessThan(5000);
        });
    });
});
