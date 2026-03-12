import { describe, it, expect } from "vitest";
import { spawnSubReviewers, REVIEW_FOCUS_AREAS } from "baseclaw-agent/src/reviewer-loop/sub-reviewer.js";

describe("Level 10 — Sub-Reviewer", () => {
    // ── REVIEW_FOCUS_AREAS ─────────────────────────────────

    describe("REVIEW_FOCUS_AREAS", () => {
        it("defines exactly 3 focus areas", () => {
            expect(REVIEW_FOCUS_AREAS).toHaveLength(3);
        });

        it("each focus area has label, focus, and dimensions", () => {
            for (const area of REVIEW_FOCUS_AREAS) {
                expect(area.label).toBeTruthy();
                expect(area.focus).toBeTruthy();
                expect(area.dimensions.length).toBeGreaterThanOrEqual(1);
            }
        });

        it("covers all 6 dimensions across focus areas", () => {
            const allDims = new Set(
                REVIEW_FOCUS_AREAS.flatMap((a) => a.dimensions)
            );
            expect(allDims.size).toBe(6);
        });
    });

    // ── spawnSubReviewers ──────────────────────────────────

    describe("spawnSubReviewers", () => {
        it("returns a QualityAssessment for deep review (falls back gracefully)", async () => {
            // Without a real sub-agent runtime, this will use the fallback path
            const result = await spawnSubReviewers(
                "Here is a well-structured REST API implementation...",
                "Build a REST API",
                "deep",
                "default",
                "parent-trace-1"
            );

            expect(result).toBeDefined();
            expect(typeof result.overallScore).toBe("number");
            expect(result.dimensions).toHaveLength(6);
            expect(["approved", "needs_revision", "needs_hitl"]).toContain(result.verdict);
            expect(result.reviewId).toBeTruthy();
            expect(result.timestamp).toBeTruthy();
        }, 60_000);

        it("returns a QualityAssessment for parallel review (falls back gracefully)", async () => {
            const result = await spawnSubReviewers(
                "Implementation of user authentication with JWT...",
                "Implement user auth",
                "parallel",
                "default",
                "parent-trace-2"
            );

            expect(result).toBeDefined();
            expect(typeof result.overallScore).toBe("number");
            expect(result.dimensions).toHaveLength(6);
            expect(["approved", "needs_revision", "needs_hitl"]).toContain(result.verdict);
        }, 60_000);

        it("fallback assessment has low confidence", async () => {
            const result = await spawnSubReviewers(
                "test output",
                "test task",
                "deep",
                "default",
                "trace-id"
            );

            // Fallback should have very low confidence since sub-agent failed
            expect(result.confidence).toBeLessThanOrEqual(65);
        }, 60_000);
    });
});
