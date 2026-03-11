import { describe, it, expect } from "vitest";
import {
    createRevisionRound,
    updateRevisionRoundWithRevision,
    checkStagnation,
    shouldEscalateToHITL,
    formatRevisionHistory,
    getScoreTrend,
} from "baseclaw-agent/src/reviewer-loop/revision-manager.js";
import { buildSystemAwareness } from "baseclaw-agent/src/reviewer-loop/quality-scorer.js";
import type { RevisionRound, QualityAssessment } from "baseclaw-agent/src/reviewer-loop/types.js";

function buildMockAssessment(score: number): QualityAssessment {
    return {
        reviewId: `review-${score}`,
        overallScore: score,
        dimensions: [],
        verdict: score >= 85 ? "approved" : score <= 40 ? "needs_hitl" : "needs_revision",
        confidence: 70,
        systemAwareness: buildSystemAwareness(),
        triggerType: "mandatory_gate",
        sourceAgent: "execution",
        taskContext: "test task",
        timestamp: new Date().toISOString(),
        langsmithTraceId: `trace-${score}`,
    };
}

describe("Level 10 — Revision Manager", () => {
    // ── createRevisionRound ────────────────────────────────

    describe("createRevisionRound", () => {
        it("creates a round with all fields", () => {
            const assessment = buildMockAssessment(60);
            const round = createRevisionRound(1, "test output", assessment, null);

            expect(round.roundNumber).toBe(1);
            expect(round.originalOutput).toBe("test output");
            expect(round.assessment.overallScore).toBe(60);
            expect(round.feedback).toBeNull();
            expect(round.revisedOutput).toBeNull();
            expect(round.timestamp).toBeTruthy();
        });

        it("truncates long output to 5000 chars", () => {
            const longOutput = "x".repeat(10000);
            const round = createRevisionRound(1, longOutput, buildMockAssessment(50), null);
            expect(round.originalOutput.length).toBe(5000);
        });
    });

    // ── updateRevisionRoundWithRevision ────────────────────

    describe("updateRevisionRoundWithRevision", () => {
        it("adds revised output to a round", () => {
            const round = createRevisionRound(1, "original", buildMockAssessment(50), null);
            const updated = updateRevisionRoundWithRevision(round, "revised output");

            expect(updated.revisedOutput).toBe("revised output");
            expect(updated.originalOutput).toBe("original");
        });

        it("truncates long revised output", () => {
            const round = createRevisionRound(1, "original", buildMockAssessment(50), null);
            const updated = updateRevisionRoundWithRevision(round, "y".repeat(10000));
            expect(updated.revisedOutput!.length).toBe(5000);
        });
    });

    // ── checkStagnation ────────────────────────────────────

    describe("checkStagnation", () => {
        it("returns false for less than 2 rounds", () => {
            expect(checkStagnation([])).toBe(false);
            expect(
                checkStagnation([
                    createRevisionRound(1, "out", buildMockAssessment(50), null),
                ])
            ).toBe(false);
        });

        it("returns true when score doesn't improve by at least 5", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(60), null),
                createRevisionRound(2, "out", buildMockAssessment(62), null),
            ];
            expect(checkStagnation(rounds)).toBe(true);
        });

        it("returns false when score improves by 5 or more", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(60), null),
                createRevisionRound(2, "out", buildMockAssessment(70), null),
            ];
            expect(checkStagnation(rounds)).toBe(false);
        });

        it("returns true when score decreases", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(70), null),
                createRevisionRound(2, "out", buildMockAssessment(65), null),
            ];
            expect(checkStagnation(rounds)).toBe(true);
        });

        it("only checks last two rounds", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(40), null),
                createRevisionRound(2, "out", buildMockAssessment(50), null), // +10
                createRevisionRound(3, "out", buildMockAssessment(52), null), // +2 (stagnation)
            ];
            expect(checkStagnation(rounds)).toBe(true);
        });
    });

    // ── shouldEscalateToHITL ───────────────────────────────

    describe("shouldEscalateToHITL", () => {
        it("escalates when max rounds reached", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(50), null),
                createRevisionRound(2, "out", buildMockAssessment(60), null),
                createRevisionRound(3, "out", buildMockAssessment(70), null),
            ];
            const result = shouldEscalateToHITL(rounds, 3);
            expect(result.shouldEscalate).toBe(true);
            expect(result.reason).toContain("Maximum revision rounds");
        });

        it("escalates when stagnation detected", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(55), null),
                createRevisionRound(2, "out", buildMockAssessment(56), null),
            ];
            const result = shouldEscalateToHITL(rounds, 5);
            expect(result.shouldEscalate).toBe(true);
            expect(result.reason).toContain("stagnation");
        });

        it("does not escalate when improving within limits", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(50), null),
                createRevisionRound(2, "out", buildMockAssessment(65), null),
            ];
            const result = shouldEscalateToHITL(rounds, 5);
            expect(result.shouldEscalate).toBe(false);
            expect(result.reason).toBe("");
        });

        it("does not escalate for a single round", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(50), null),
            ];
            const result = shouldEscalateToHITL(rounds, 3);
            expect(result.shouldEscalate).toBe(false);
        });

        it("uses config default for maxRounds when not provided", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(50), null),
                createRevisionRound(2, "out", buildMockAssessment(60), null),
                createRevisionRound(3, "out", buildMockAssessment(70), null),
            ];
            const result = shouldEscalateToHITL(rounds);
            expect(result.shouldEscalate).toBe(true);
        });
    });

    // ── formatRevisionHistory ──────────────────────────────

    describe("formatRevisionHistory", () => {
        it("formats empty history", () => {
            expect(formatRevisionHistory([])).toBe("No revision history.");
        });

        it("formats multiple rounds with scores and verdicts", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(50), null),
                createRevisionRound(2, "out", buildMockAssessment(70), null),
            ];
            const formatted = formatRevisionHistory(rounds);
            expect(formatted).toContain("Round 1: score=50");
            expect(formatted).toContain("Round 2: score=70");
            expect(formatted).toContain("needs_revision");
        });
    });

    // ── getScoreTrend ──────────────────────────────────────

    describe("getScoreTrend", () => {
        it("returns empty array for no history", () => {
            expect(getScoreTrend([])).toEqual([]);
        });

        it("returns scores in order", () => {
            const rounds = [
                createRevisionRound(1, "out", buildMockAssessment(40), null),
                createRevisionRound(2, "out", buildMockAssessment(60), null),
                createRevisionRound(3, "out", buildMockAssessment(80), null),
            ];
            expect(getScoreTrend(rounds)).toEqual([40, 60, 80]);
        });
    });
});
