import { describe, it, expect } from "vitest";
import { generateFeedback, formatFeedbackForAgent } from "baseclaw-agent/src/reviewer-loop/feedback-generator.js";
import { buildSystemAwareness } from "baseclaw-agent/src/reviewer-loop/quality-scorer.js";
import { ALL_QUALITY_DIMENSIONS } from "baseclaw-agent/src/reviewer-loop/types.js";
import type { QualityAssessment } from "baseclaw-agent/src/reviewer-loop/types.js";

/**
 * Helper to build a mock assessment for testing.
 */
function buildTestAssessment(
    overrides: Partial<QualityAssessment> = {}
): QualityAssessment {
    return {
        reviewId: "test-review-1",
        overallScore: overrides.overallScore ?? 60,
        dimensions: overrides.dimensions ??
            ALL_QUALITY_DIMENSIONS.map((dim) => ({
                dimension: dim,
                score: dim === "accuracy" ? 40 : dim === "completeness" ? 50 : 80,
                reasoning: `${dim} score reasoning`,
            })),
        verdict: overrides.verdict ?? "needs_revision",
        confidence: 75,
        systemAwareness: buildSystemAwareness(),
        triggerType: "mandatory_gate",
        sourceAgent: overrides.sourceAgent ?? "execution",
        taskContext: overrides.taskContext ?? "Build a REST API endpoint",
        timestamp: new Date().toISOString(),
        langsmithTraceId: "trace-feedback-test",
    };
}

describe("Level 10 — Feedback Generator", () => {
    describe("generateFeedback", () => {
        it("produces structured feedback with issues and retain", async () => {
            const assessment = buildTestAssessment();
            const feedback = await generateFeedback(
                assessment,
                "Here is my incomplete API implementation without error handling...",
                "Build a REST API endpoint with error handling",
                2
            );

            // Core structure
            expect(feedback.targetAgent).toBe("execution");
            expect(feedback.reviewId).toBe("test-review-1");
            expect(feedback.maxRevisionsRemaining).toBe(2);
            expect(feedback.timestamp).toBeTruthy();

            // Should have at least one issue (accuracy scored 40)
            expect(feedback.issues.length).toBeGreaterThanOrEqual(1);

            // Each issue should have all fields
            for (const issue of feedback.issues) {
                expect(["accuracy", "completeness", "clarity", "relevance", "safety", "alignment"]).toContain(
                    issue.dimension
                );
                expect(["critical", "major", "minor"]).toContain(issue.severity);
                expect(issue.description).toBeTruthy();
                expect(issue.suggestion).toBeTruthy();
            }

            // Should retain at least one aspect
            expect(feedback.retain.length).toBeGreaterThanOrEqual(1);
        }, 30_000);

        it("handles low-scoring assessment with multiple critical issues", async () => {
            const assessment = buildTestAssessment({
                overallScore: 30,
                dimensions: ALL_QUALITY_DIMENSIONS.map((dim) => ({
                    dimension: dim,
                    score: 30,
                    reasoning: `Poor ${dim}`,
                })),
            });

            const feedback = await generateFeedback(
                assessment,
                "This is a very poor output with many issues that does not address the task at all.",
                "Complex task requiring careful analysis",
                1
            );

            // Should have multiple issues for a low score
            expect(feedback.issues.length).toBeGreaterThanOrEqual(1);
            expect(feedback.maxRevisionsRemaining).toBe(1);
        }, 30_000);
    });

    describe("formatFeedbackForAgent", () => {
        it("formats feedback as readable text", () => {
            const formatted = formatFeedbackForAgent({
                targetAgent: "execution",
                issues: [
                    {
                        dimension: "accuracy",
                        severity: "critical",
                        description: "Missing error handling",
                        suggestion: "Add try-catch blocks",
                    },
                    {
                        dimension: "completeness",
                        severity: "major",
                        description: "Incomplete API",
                        suggestion: "Add PUT and DELETE endpoints",
                    },
                ],
                retain: ["Good code structure", "Clear naming"],
                maxRevisionsRemaining: 2,
                reviewId: "review-fmt-test",
                timestamp: new Date().toISOString(),
            });

            expect(formatted).toContain("Reviewer Feedback");
            expect(formatted).toContain("CRITICAL");
            expect(formatted).toContain("accuracy");
            expect(formatted).toContain("Missing error handling");
            expect(formatted).toContain("Add try-catch blocks");
            expect(formatted).toContain("MAJOR");
            expect(formatted).toContain("completeness");
            expect(formatted).toContain("Good code structure");
            expect(formatted).toContain("Revisions remaining: 2");
        });

        it("handles empty issues and retain lists", () => {
            const formatted = formatFeedbackForAgent({
                targetAgent: "ideation",
                issues: [],
                retain: [],
                maxRevisionsRemaining: 0,
                reviewId: "review-empty",
                timestamp: new Date().toISOString(),
            });

            expect(formatted).toContain("Reviewer Feedback");
            expect(formatted).toContain("Revisions remaining: 0");
        });
    });
});
