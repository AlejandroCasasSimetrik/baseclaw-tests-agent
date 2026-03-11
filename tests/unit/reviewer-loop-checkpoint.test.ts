import { describe, it, expect } from "vitest";
import { checkpointWithReviewer, shouldCheckpoint } from "baseclaw-agent/src/reviewer-loop/checkpoint.js";
import type { CheckpointRequest } from "baseclaw-agent/src/reviewer-loop/types.js";

describe("Level 10 — Mid-Execution Checkpoints", () => {
    // ── shouldCheckpoint ───────────────────────────────────

    describe("shouldCheckpoint", () => {
        it("returns false for step 0", () => {
            expect(shouldCheckpoint(0)).toBe(false);
        });

        it("returns true at configured interval (default 3)", () => {
            expect(shouldCheckpoint(3)).toBe(true);
            expect(shouldCheckpoint(6)).toBe(true);
            expect(shouldCheckpoint(9)).toBe(true);
        });

        it("returns false between intervals", () => {
            expect(shouldCheckpoint(1)).toBe(false);
            expect(shouldCheckpoint(2)).toBe(false);
            expect(shouldCheckpoint(4)).toBe(false);
            expect(shouldCheckpoint(5)).toBe(false);
        });
    });

    // ── checkpointWithReviewer (real LLM) ──────────────────

    describe("checkpointWithReviewer", () => {
        it("returns a valid CheckpointResponse with verdict", async () => {
            const request: CheckpointRequest = {
                progressSummary: "Completed database schema design and API route definitions.",
                plannedNextSteps: "Implement authentication middleware and write integration tests.",
                concerns: [],
                agentType: "execution",
                stepNumber: 3,
                tenantId: "default",
                taskContext: "Build a REST API with user authentication",
            };

            const response = await checkpointWithReviewer(request);

            expect(response).toBeDefined();
            expect(["continue", "adjust", "pause"]).toContain(response.verdict);
            expect(response.timestamp).toBeTruthy();
        }, 30_000);

        it("returns 'continue' for on-track progress", async () => {
            const request: CheckpointRequest = {
                progressSummary: "All planned steps completed. API endpoints working correctly with proper error handling.",
                plannedNextSteps: "Add rate limiting and caching as bonus improvements.",
                concerns: [],
                agentType: "execution",
                stepNumber: 6,
                tenantId: "default",
                taskContext: "Build a REST API",
            };

            const response = await checkpointWithReviewer(request);
            // The LLM should likely say "continue" for on-track work
            expect(["continue", "adjust", "pause"]).toContain(response.verdict);
        }, 30_000);

        it("handles requests with concerns", async () => {
            const request: CheckpointRequest = {
                progressSummary: "Started implementing the payment system but ran into issues with the API.",
                plannedNextSteps: "Try an alternative payment provider.",
                concerns: [
                    "The original payment API is deprecated",
                    "Not sure if the alternative is compatible",
                ],
                agentType: "execution",
                stepNumber: 3,
                tenantId: "default",
                taskContext: "Implement payment processing",
            };

            const response = await checkpointWithReviewer(request);
            expect(response).toBeDefined();
            expect(["continue", "adjust", "pause"]).toContain(response.verdict);

            // If verdict is "adjust", guidance should be provided
            if (response.verdict === "adjust") {
                expect(response.guidance).toBeTruthy();
            }
            // If verdict is "pause", reason should be provided
            if (response.verdict === "pause") {
                expect(response.reason).toBeTruthy();
            }
        }, 30_000);

        it("includes guidance when verdict is adjust", async () => {
            const request: CheckpointRequest = {
                progressSummary: "Built the frontend but completely ignored the backend requirements that were specified.",
                plannedNextSteps: "Continue building more frontend pages.",
                concerns: ["The task was primarily about backend work"],
                agentType: "execution",
                stepNumber: 6,
                tenantId: "default",
                taskContext: "Build a backend API with PostgreSQL database integration",
            };

            const response = await checkpointWithReviewer(request);
            expect(response).toBeDefined();
            // The LLM should detect the drift and suggest adjustment
            expect(["adjust", "pause"]).toContain(response.verdict);
        }, 30_000);
    });
});
