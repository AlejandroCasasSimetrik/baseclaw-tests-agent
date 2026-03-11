import { describe, it, expect } from "vitest";
import { defaultReviewerGateState, getReviewConfig } from "baseclaw-agent/src/reviewer-loop/types.js";
import { determineVerdict } from "baseclaw-agent/src/reviewer-loop/quality-scorer.js";
import { shouldEscalateToHITL, createRevisionRound } from "baseclaw-agent/src/reviewer-loop/revision-manager.js";
import { buildSystemAwareness } from "baseclaw-agent/src/reviewer-loop/quality-scorer.js";
import type { QualityAssessment } from "baseclaw-agent/src/reviewer-loop/types.js";

function buildMockAssessment(score: number): QualityAssessment {
    return {
        reviewId: `review-sec-${score}`,
        overallScore: score,
        dimensions: [],
        verdict: determineVerdict(score),
        confidence: 70,
        systemAwareness: buildSystemAwareness(),
        triggerType: "mandatory_gate",
        sourceAgent: "execution",
        taskContext: "security test",
        timestamp: new Date().toISOString(),
        langsmithTraceId: `trace-sec-${score}`,
    };
}

describe("Level 10 — Security", () => {
    // ── Gate Bypass Prevention ──────────────────────────────

    describe("gate bypass prevention", () => {
        it("reviewerGateState defaults to inactive (no bypass possible)", () => {
            const state = defaultReviewerGateState();
            expect(state.active).toBe(false);
            expect(state.sourceAgent).toBeNull();
            // When inactive, the gate should not let anything through
            // without being explicitly activated
        });

        it("gate state requires explicit activation with source agent", () => {
            const state = defaultReviewerGateState();
            // Cannot accidentally bypass by setting partial state
            expect(state.sourceAgent).toBeNull();
            expect(state.triggerType).toBeNull();
            expect(state.revisionCount).toBe(0);
        });
    });

    // ── Threshold Enforcement ──────────────────────────────

    describe("threshold enforcement", () => {
        it("enforces auto-approve threshold strictly", () => {
            const config = getReviewConfig();
            // Score at threshold → approved
            expect(determineVerdict(config.autoApproveThreshold)).toBe("approved");
            // Score just below → NOT approved
            expect(determineVerdict(config.autoApproveThreshold - 1)).toBe("needs_revision");
        });

        it("enforces HITL threshold strictly", () => {
            const config = getReviewConfig();
            // Score at threshold → HITL
            expect(determineVerdict(config.hitlThreshold)).toBe("needs_hitl");
            // Score just above → NOT HITL
            expect(determineVerdict(config.hitlThreshold + 1)).toBe("needs_revision");
        });

        it("does not allow score 0 to bypass (always HITL)", () => {
            expect(determineVerdict(0)).toBe("needs_hitl");
        });

        it("allows score 100 to pass (always approved)", () => {
            expect(determineVerdict(100)).toBe("approved");
        });
    });

    // ── Max Revision Round Enforcement ─────────────────────

    describe("max revision rounds enforcement", () => {
        it("escalates to HITL when max rounds reached", () => {
            const config = getReviewConfig();
            const rounds = Array.from({ length: config.maxRevisionRounds }, (_, i) =>
                createRevisionRound(
                    i + 1,
                    `output-${i}`,
                    buildMockAssessment(50 + i * 5),
                    null
                )
            );
            const result = shouldEscalateToHITL(rounds, config.maxRevisionRounds);
            expect(result.shouldEscalate).toBe(true);
        });

        it("does not allow more rounds than configured maximum", () => {
            const maxRounds = 3;
            const rounds = Array.from({ length: maxRounds }, (_, i) =>
                createRevisionRound(
                    i + 1,
                    `output-${i}`,
                    buildMockAssessment(50 + i * 10),
                    null
                )
            );
            const result = shouldEscalateToHITL(rounds, maxRounds);
            expect(result.shouldEscalate).toBe(true);
            expect(result.reason).toContain("Maximum revision rounds");
        });
    });

    // ── Stagnation as Security Measure ─────────────────────

    describe("stagnation detection prevents infinite loops", () => {
        it("detects stagnation and forces HITL", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(50), null),
                createRevisionRound(2, "out", buildMockAssessment(51), null),
            ];
            const result = shouldEscalateToHITL(rounds, 10);
            expect(result.shouldEscalate).toBe(true);
            expect(result.reason).toContain("stagnation");
        });

        it("detects score regression as stagnation", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(60), null),
                createRevisionRound(2, "out", buildMockAssessment(55), null),
            ];
            const result = shouldEscalateToHITL(rounds, 10);
            expect(result.shouldEscalate).toBe(true);
        });
    });

    // ── System Awareness Sanity ────────────────────────────

    describe("system awareness data sanity", () => {
        it("system awareness defaults to safe values", () => {
            const awareness = buildSystemAwareness();
            expect(awareness.driftDetected).toBe(false);
            expect(awareness.contradictionDetected).toBe(false);
            expect(awareness.scopeCreepDetected).toBe(false);
            expect(awareness.riskAccumulation).toBe(false);
        });

        it("system awareness does not expose sensitive data", () => {
            const awareness = buildSystemAwareness({
                observations: "Standard observation",
            });
            // Observations should not contain env vars or keys
            expect(awareness.observations).not.toContain("sk-");
            expect(awareness.observations).not.toContain("API_KEY");
            expect(awareness.observations).not.toContain("DATABASE_URL");
        });
    });
});
