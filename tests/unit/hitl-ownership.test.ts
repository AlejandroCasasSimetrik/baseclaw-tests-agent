/**
 * Level 9 — HITL Ownership Tests
 *
 * Comprehensive tests that HITL can ONLY be triggered by the Reviewer Agent.
 * Tests every agent type, sub-agent types, and edge cases.
 */

import { describe, it, expect, afterEach } from "vitest";
import { triggerHITL } from "baseclaw-agent/src/hitl/trigger.js";
import { HITLOwnershipError } from "baseclaw-agent/src/hitl/types.js";
import { resetHITLManager } from "baseclaw-agent/src/hitl/pause-resume.js";

describe("Level 9 — HITL Ownership Enforcement", () => {
    afterEach(() => {
        resetHITLManager();
    });

    const context = { test: true };
    const tenantId = "tenant-test";

    describe("Main agents — only Reviewer allowed", () => {
        const nonReviewerAgents = [
            "conversation",
            "ideation",
            "planning",
            "execution",
        ];

        for (const agent of nonReviewerAgents) {
            it(`rejects ${agent} agent`, async () => {
                await expect(
                    triggerHITL("test reason", context, agent, tenantId)
                ).rejects.toThrow(HITLOwnershipError);
            });

            it(`error for ${agent} includes agent name`, async () => {
                try {
                    await triggerHITL("test", context, agent, tenantId);
                    expect.unreachable("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(HITLOwnershipError);
                    expect((error as Error).message).toContain(agent);
                }
            });
        }

        it("allows reviewer agent", async () => {
            const request = await triggerHITL("test reason", context, "reviewer", tenantId);
            expect(request.triggeredBy).toBe("reviewer");
        });
    });

    describe("Sub-agents — all rejected", () => {
        const subAgentTypes = [
            "sub-agent-ideation",
            "sub-agent-planning",
            "sub-agent-execution",
            "sub-agent-reviewer",
            "ideation-sub-123",
            "execution-sub-456",
        ];

        for (const subAgent of subAgentTypes) {
            it(`rejects sub-agent: ${subAgent}`, async () => {
                await expect(
                    triggerHITL("test", context, subAgent, tenantId)
                ).rejects.toThrow(HITLOwnershipError);
            });
        }
    });

    describe("Edge cases", () => {
        it("rejects empty string caller", async () => {
            await expect(
                triggerHITL("test", context, "", tenantId)
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects 'Reviewer' (case-sensitive)", async () => {
            await expect(
                triggerHITL("test", context, "Reviewer", tenantId)
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects 'REVIEWER' (uppercase)", async () => {
            await expect(
                triggerHITL("test", context, "REVIEWER", tenantId)
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects 'reviewer ' (trailing space)", async () => {
            await expect(
                triggerHITL("test", context, "reviewer ", tenantId)
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects 'system' caller", async () => {
            await expect(
                triggerHITL("test", context, "system", tenantId)
            ).rejects.toThrow(HITLOwnershipError);
        });

        it("rejects 'heartbeat' caller", async () => {
            await expect(
                triggerHITL("test", context, "heartbeat", tenantId)
            ).rejects.toThrow(HITLOwnershipError);
        });
    });
});
