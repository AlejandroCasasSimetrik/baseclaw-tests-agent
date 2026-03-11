import { describe, it, expect } from "vitest";
import {
    reviewConsistencyEvaluator,
    feedbackActionabilityEvaluator,
    revisionImprovementEvaluator,
    distillationQualityEvaluator,
    mandatoryGateCoverageEvaluator,
    driftDetectionAccuracyEvaluator,
    checkpointResponsivenessEvaluator,
    EVALUATOR_TEMPLATES,
} from "baseclaw-agent/src/observability/evaluators.js";

describe("Level 10 — Reviewer Loop Evaluators", () => {
    // ── EVALUATOR_TEMPLATES ────────────────────────────────

    it("EVALUATOR_TEMPLATES includes all 14 evaluators (7 original + 7 Level 10)", () => {
        const keys = Object.keys(EVALUATOR_TEMPLATES);
        expect(keys).toHaveLength(14);

        // Level 10 keys
        expect(keys).toContain("review_consistency");
        expect(keys).toContain("feedback_actionability");
        expect(keys).toContain("revision_improvement");
        expect(keys).toContain("distillation_quality");
        expect(keys).toContain("mandatory_gate_coverage");
        expect(keys).toContain("drift_detection_accuracy");
        expect(keys).toContain("checkpoint_responsiveness");
    });

    // ── reviewConsistencyEvaluator ─────────────────────────

    describe("reviewConsistencyEvaluator", () => {
        it("scores 1.0 for consistent scores (diff <= 5)", async () => {
            const result = await reviewConsistencyEvaluator({
                inputs: {},
                outputs: { score1: 80, score2: 83 },
            });
            expect(result.key).toBe("review_consistency");
            expect(result.score).toBe(1.0);
        });

        it("scores lower for inconsistent scores", async () => {
            const result = await reviewConsistencyEvaluator({
                inputs: {},
                outputs: { score1: 80, score2: 60 },
            });
            expect(result.score).toBeLessThan(1.0);
        });

        it("scores very low for wildly different scores", async () => {
            const result = await reviewConsistencyEvaluator({
                inputs: {},
                outputs: { score1: 90, score2: 30 },
            });
            expect(result.score).toBeLessThanOrEqual(0.1);
        });
    });

    // ── feedbackActionabilityEvaluator ──────────────────────

    describe("feedbackActionabilityEvaluator", () => {
        it("produces a valid result with LLM scoring", async () => {
            const result = await feedbackActionabilityEvaluator({
                inputs: {},
                outputs: {
                    feedback:
                        "1. [CRITICAL] [accuracy] The implementation uses deprecated API methods that may break. Suggestion: Migrate to v3 of the API using the new fetch-based client. 2. [MAJOR] [completeness] Missing error handling for network failures. Suggestion: Add try-catch blocks with retry logic.",
                },
            });
            expect(result.key).toBe("feedback_actionability");
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
        }, 30_000);
    });

    // ── revisionImprovementEvaluator ───────────────────────

    describe("revisionImprovementEvaluator", () => {
        it("scores high for significant improvement", async () => {
            const result = await revisionImprovementEvaluator({
                inputs: {},
                outputs: { preRevisionScore: 50, postRevisionScore: 80 },
            });
            expect(result.key).toBe("revision_improvement");
            expect(result.score).toBeGreaterThanOrEqual(0.8);
        });

        it("scores low for no improvement", async () => {
            const result = await revisionImprovementEvaluator({
                inputs: {},
                outputs: { preRevisionScore: 60, postRevisionScore: 55 },
            });
            expect(result.score).toBeLessThanOrEqual(0.2);
        });
    });

    // ── distillationQualityEvaluator ───────────────────────

    describe("distillationQualityEvaluator", () => {
        it("produces a valid result for real knowledge", async () => {
            const result = await distillationQualityEvaluator({
                inputs: {},
                outputs: {
                    distilledKnowledge:
                        "For REST API implementations, always validate request bodies using schema validation (e.g., Zod) before processing. This prevents malformed data from reaching the database and provides consistent error responses to clients.",
                    knowledgeType: "pattern",
                },
            });
            expect(result.key).toBe("distillation_quality");
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
        }, 30_000);
    });

    // ── mandatoryGateCoverageEvaluator ─────────────────────

    describe("mandatoryGateCoverageEvaluator", () => {
        it("scores 1.0 for 100% coverage", async () => {
            const result = await mandatoryGateCoverageEvaluator({
                inputs: {},
                outputs: { totalAgentCompletions: 10, reviewerGateTraces: 10 },
            });
            expect(result.score).toBe(1.0);
        });

        it("scores 0.0 for incomplete coverage", async () => {
            const result = await mandatoryGateCoverageEvaluator({
                inputs: {},
                outputs: { totalAgentCompletions: 10, reviewerGateTraces: 9 },
            });
            expect(result.score).toBe(0.0);
            expect(result.comment).toContain("CRITICAL");
        });

        it("scores 1.0 for zero completions", async () => {
            const result = await mandatoryGateCoverageEvaluator({
                inputs: {},
                outputs: { totalAgentCompletions: 0, reviewerGateTraces: 0 },
            });
            expect(result.score).toBe(1.0);
        });
    });

    // ── driftDetectionAccuracyEvaluator ────────────────────

    describe("driftDetectionAccuracyEvaluator", () => {
        it("scores 1.0 when all drifts caught", async () => {
            const result = await driftDetectionAccuracyEvaluator({
                inputs: {},
                outputs: { totalDriftScenarios: 5, driftsCaught: 5 },
            });
            expect(result.score).toBe(1.0);
        });

        it("scores proportionally for partial detection", async () => {
            const result = await driftDetectionAccuracyEvaluator({
                inputs: {},
                outputs: { totalDriftScenarios: 10, driftsCaught: 7 },
            });
            expect(result.score).toBeCloseTo(0.7, 1);
        });

        it("scores 1.0 when no drift scenarios", async () => {
            const result = await driftDetectionAccuracyEvaluator({
                inputs: {},
                outputs: { totalDriftScenarios: 0, driftsCaught: 0 },
            });
            expect(result.score).toBe(1.0);
        });
    });

    // ── checkpointResponsivenessEvaluator ───────────────────

    describe("checkpointResponsivenessEvaluator", () => {
        it("scores 1.0 for tasks shorter than interval", async () => {
            const result = await checkpointResponsivenessEvaluator({
                inputs: {},
                outputs: { totalSteps: 2, checkpointCount: 0, configuredInterval: 3 },
            });
            expect(result.score).toBe(1.0);
        });

        it("scores 1.0 for correct number of checkpoints", async () => {
            const result = await checkpointResponsivenessEvaluator({
                inputs: {},
                outputs: { totalSteps: 9, checkpointCount: 3, configuredInterval: 3 },
            });
            expect(result.score).toBe(1.0);
        });

        it("scores lower for missing checkpoints", async () => {
            const result = await checkpointResponsivenessEvaluator({
                inputs: {},
                outputs: { totalSteps: 12, checkpointCount: 1, configuredInterval: 3 },
            });
            expect(result.score).toBeLessThan(1.0);
        });
    });
});
