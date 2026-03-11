import { describe, it, expect } from "vitest";
import {
    ALL_QUALITY_DIMENSIONS,
    defaultReviewerGateState,
    getReviewConfig,
} from "baseclaw-agent/src/reviewer-loop/types.js";
import type {
    QualityDimension,
    ReviewVerdict,
    ReviewTriggerType,
    IssueSeverity,
    CheckpointVerdict,
    KnowledgeType,
    ReviewerGateState,
    QualityAssessment,
    StructuredFeedback,
    FeedbackIssue,
    RevisionRound,
    CheckpointRequest,
    CheckpointResponse,
    DistilledKnowledge,
    DimensionScore,
    SystemAwareness,
} from "baseclaw-agent/src/reviewer-loop/types.js";

describe("Level 10 — Reviewer Loop Types", () => {
    // ── Quality Dimensions ─────────────────────────────────

    it("defines exactly 6 quality dimensions", () => {
        expect(ALL_QUALITY_DIMENSIONS).toHaveLength(6);
    });

    it("includes all required dimensions", () => {
        const expected: QualityDimension[] = [
            "accuracy",
            "completeness",
            "clarity",
            "relevance",
            "safety",
            "alignment",
        ];
        expect(ALL_QUALITY_DIMENSIONS).toEqual(expected);
    });

    // ── Review Config ──────────────────────────────────────

    it("getReviewConfig returns valid defaults", () => {
        const config = getReviewConfig();
        expect(config.autoApproveThreshold).toBe(85);
        expect(config.hitlThreshold).toBe(40);
        expect(config.maxRevisionRounds).toBe(3);
        expect(config.checkpointInterval).toBe(3);
    });

    it("getReviewConfig reads from environment variables", () => {
        const original = process.env.REVIEW_AUTO_APPROVE_THRESHOLD;
        process.env.REVIEW_AUTO_APPROVE_THRESHOLD = "90";
        const config = getReviewConfig();
        expect(config.autoApproveThreshold).toBe(90);
        process.env.REVIEW_AUTO_APPROVE_THRESHOLD = original;
    });

    it("getReviewConfig handles missing env vars with defaults", () => {
        const config = getReviewConfig();
        expect(typeof config.autoApproveThreshold).toBe("number");
        expect(typeof config.hitlThreshold).toBe("number");
        expect(typeof config.maxRevisionRounds).toBe("number");
        expect(typeof config.checkpointInterval).toBe("number");
    });

    // ── Default Reviewer Gate State ────────────────────────

    it("defaultReviewerGateState returns inactive state", () => {
        const state = defaultReviewerGateState();
        expect(state.active).toBe(false);
        expect(state.sourceAgent).toBeNull();
        expect(state.revisionCount).toBe(0);
        expect(state.revisionHistory).toEqual([]);
        expect(state.currentReviewId).toBeNull();
        expect(state.triggerType).toBeNull();
        expect(state.pendingFeedback).toBeNull();
    });

    it("defaultReviewerGateState returns a new object each time", () => {
        const state1 = defaultReviewerGateState();
        const state2 = defaultReviewerGateState();
        expect(state1).not.toBe(state2);
        expect(state1).toEqual(state2);
    });

    // ── Type Shape Validation ──────────────────────────────

    it("QualityAssessment type has all required fields", () => {
        const assessment: QualityAssessment = {
            reviewId: "test-review-1",
            overallScore: 85,
            dimensions: ALL_QUALITY_DIMENSIONS.map((dim) => ({
                dimension: dim,
                score: 85,
                reasoning: "test",
            })),
            verdict: "approved" as ReviewVerdict,
            confidence: 90,
            systemAwareness: {
                activeAgents: [],
                activeSubAgents: [],
                pendingTasks: 0,
                driftDetected: false,
                contradictionDetected: false,
                scopeCreepDetected: false,
                riskAccumulation: false,
                observations: "none",
            },
            triggerType: "mandatory_gate" as ReviewTriggerType,
            sourceAgent: "execution",
            taskContext: "test task",
            timestamp: new Date().toISOString(),
            langsmithTraceId: "trace-1",
        };
        expect(assessment.reviewId).toBeDefined();
        expect(assessment.dimensions).toHaveLength(6);
        expect(assessment.verdict).toBe("approved");
    });

    it("StructuredFeedback type has all required fields", () => {
        const feedback: StructuredFeedback = {
            targetAgent: "execution",
            issues: [
                {
                    dimension: "accuracy",
                    severity: "major" as IssueSeverity,
                    description: "Incorrect claim",
                    suggestion: "Verify against sources",
                },
            ],
            retain: ["Good structure"],
            maxRevisionsRemaining: 2,
            reviewId: "review-1",
            timestamp: new Date().toISOString(),
        };
        expect(feedback.issues).toHaveLength(1);
        expect(feedback.retain).toHaveLength(1);
    });

    it("RevisionRound type has all required fields", () => {
        const round: RevisionRound = {
            roundNumber: 1,
            originalOutput: "test output",
            assessment: {
                reviewId: "r-1",
                overallScore: 60,
                dimensions: [],
                verdict: "needs_revision",
                confidence: 70,
                systemAwareness: {
                    activeAgents: [],
                    activeSubAgents: [],
                    pendingTasks: 0,
                    driftDetected: false,
                    contradictionDetected: false,
                    scopeCreepDetected: false,
                    riskAccumulation: false,
                    observations: "",
                },
                triggerType: "mandatory_gate",
                sourceAgent: "execution",
                taskContext: "test",
                timestamp: new Date().toISOString(),
                langsmithTraceId: "trace-1",
            },
            feedback: null,
            revisedOutput: null,
            timestamp: new Date().toISOString(),
        };
        expect(round.roundNumber).toBe(1);
        expect(round.feedback).toBeNull();
    });

    it("CheckpointRequest has all required fields", () => {
        const request: CheckpointRequest = {
            progressSummary: "Step 1 done",
            plannedNextSteps: "Step 2",
            concerns: [],
            agentType: "execution",
            stepNumber: 3,
            tenantId: "default",
            taskContext: "test task",
        };
        expect(request.stepNumber).toBe(3);
        expect(request.concerns).toHaveLength(0);
    });

    it("DistilledKnowledge has all required fields", () => {
        const knowledge: DistilledKnowledge = {
            content: "Always validate inputs before processing",
            knowledgeType: "pattern" as KnowledgeType,
            agentRelevance: ["execution", "planning"],
            sourceTaskId: "task-123",
            sourceReviewId: "review-456",
            tenantId: "default",
            timestamp: new Date().toISOString(),
        };
        expect(knowledge.knowledgeType).toBe("pattern");
        expect(knowledge.agentRelevance).toHaveLength(2);
    });

    // ── Enum Coverage ──────────────────────────────────────

    it("ReviewVerdict covers all variants", () => {
        const verdicts: ReviewVerdict[] = [
            "approved",
            "needs_revision",
            "needs_hitl",
        ];
        expect(verdicts).toHaveLength(3);
    });

    it("ReviewTriggerType covers all variants", () => {
        const triggers: ReviewTriggerType[] = [
            "mandatory_gate",
            "checkpoint",
            "agent_requested",
            "user_requested",
        ];
        expect(triggers).toHaveLength(4);
    });

    it("CheckpointVerdict covers all variants", () => {
        const verdicts: CheckpointVerdict[] = [
            "continue",
            "adjust",
            "pause",
        ];
        expect(verdicts).toHaveLength(3);
    });

    it("KnowledgeType covers all variants", () => {
        const types: KnowledgeType[] = [
            "pattern",
            "anti_pattern",
            "criteria",
            "template",
        ];
        expect(types).toHaveLength(4);
    });

    it("IssueSeverity covers all variants", () => {
        const severities: IssueSeverity[] = [
            "critical",
            "major",
            "minor",
        ];
        expect(severities).toHaveLength(3);
    });
});
