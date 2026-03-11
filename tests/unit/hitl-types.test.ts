/**
 * Level 9 — HITL Types Tests
 *
 * Tests for HITL type definitions and HITLOwnershipError.
 */

import { describe, it, expect } from "vitest";
import { HITLOwnershipError } from "baseclaw-agent/src/hitl/types.js";
import type {
    HITLState,
    HITLRequest,
    HITLResponse,
    HITLOption,
    HITLEventRecord,
} from "baseclaw-agent/src/hitl/types.js";

describe("Level 9 — HITL Types", () => {
    describe("HITLOwnershipError", () => {
        it("creates error with correct name", () => {
            const error = new HITLOwnershipError("execution");
            expect(error.name).toBe("HITLOwnershipError");
        });

        it("includes caller agent in message", () => {
            const error = new HITLOwnershipError("execution");
            expect(error.message).toContain("execution");
            expect(error.message).toContain("not authorized");
        });

        it("mentions Reviewer Agent", () => {
            const error = new HITLOwnershipError("ideation");
            expect(error.message).toContain("Reviewer Agent");
        });

        it("mentions code-level enforcement", () => {
            const error = new HITLOwnershipError("planning");
            expect(error.message).toContain("code level");
        });

        it("is an instance of Error", () => {
            const error = new HITLOwnershipError("conversation");
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("Type shape validation", () => {
        it("HITLState has correct values", () => {
            const states: HITLState[] = ["idle", "pending", "resolved"];
            expect(states).toHaveLength(3);
        });

        it("HITLOption has required fields", () => {
            const option: HITLOption = {
                label: "Approve",
                value: "approve",
                description: "Approve the changes",
            };
            expect(option.label).toBe("Approve");
            expect(option.value).toBe("approve");
        });

        it("HITLRequest has all required fields", () => {
            const request: HITLRequest = {
                id: "req-1",
                reason: "Quality below threshold",
                context: { score: 0.3, output: "Test output" },
                options: [
                    { label: "Approve", value: "approve" },
                    { label: "Reject", value: "reject" },
                ],
                blocking: true,
                triggeredBy: "reviewer",
                tenantId: "tenant-1",
                createdAt: new Date().toISOString(),
                langsmithTraceId: "trace-1",
            };
            expect(request.triggeredBy).toBe("reviewer");
            expect(request.options).toHaveLength(2);
        });

        it("HITLResponse has all required fields", () => {
            const response: HITLResponse = {
                requestId: "req-1",
                userInput: "I approve this",
                selectedOption: "approve",
                respondedAt: new Date().toISOString(),
                routeToAgent: "execution",
            };
            expect(response.requestId).toBe("req-1");
        });

        it("HITLEventRecord has all fields for episodic memory", () => {
            const event: HITLEventRecord = {
                triggerReason: "Quality below threshold",
                triggeredBy: "reviewer",
                contextSnapshot: { score: 0.3 },
                userResponse: "Approved",
                resolution: "Routed to execution",
                pauseDuration: 5000,
                langsmithTraceId: "trace-1",
                tenantId: "tenant-1",
            };
            expect(event.triggeredBy).toBe("reviewer");
            expect(event.pauseDuration).toBe(5000);
        });
    });
});
