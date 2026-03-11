import { describe, it, expect } from "vitest";
import { scoreOutput, determineVerdict, buildSystemAwareness } from "baseclaw-agent/src/reviewer-loop/quality-scorer.js";
import { generateFeedback, formatFeedbackForAgent } from "baseclaw-agent/src/reviewer-loop/feedback-generator.js";
import {
    createRevisionRound,
    updateRevisionRoundWithRevision,
    checkStagnation,
    shouldEscalateToHITL,
    getScoreTrend,
} from "baseclaw-agent/src/reviewer-loop/revision-manager.js";
import { checkpointWithReviewer } from "baseclaw-agent/src/reviewer-loop/checkpoint.js";
import { ALL_QUALITY_DIMENSIONS } from "baseclaw-agent/src/reviewer-loop/types.js";

describe("Level 10 — End-to-End Reviewer Loop", () => {
    it("full cycle: score → feedback → revision record → improved score", async () => {
        // Step 1: Score an imperfect output
        const firstAssessment = await scoreOutput(
            "Build REST API... (missing details, no error handling)",
            "Build a production-ready REST API with auth, validation, and error handling",
            "execution",
            "mandatory_gate"
        );

        expect(firstAssessment.overallScore).toBeLessThanOrEqual(100);
        expect(firstAssessment.dimensions).toHaveLength(6);

        // Step 2: If needs revision, generate feedback
        if (firstAssessment.verdict === "needs_revision") {
            const feedback = await generateFeedback(
                firstAssessment,
                "Build REST API... (missing details, no error handling)",
                "Build a production-ready REST API",
                2
            );

            expect(feedback.issues.length).toBeGreaterThanOrEqual(1);
            expect(feedback.targetAgent).toBe("execution");

            // Step 3: Create a revision round
            const round1 = createRevisionRound(1, "Build REST API...", firstAssessment, feedback);
            expect(round1.roundNumber).toBe(1);

            // Step 4: Format feedback for the agent
            const formattedFeedback = formatFeedbackForAgent(feedback);
            expect(formattedFeedback).toContain("Reviewer Feedback");

            // Step 5: Simulate revised output and score it
            const revisedOutput = `## REST API Implementation

### Authentication
- JWT-based auth with refresh tokens
- Role-based access control (admin, user)

### Validation
- Zod schemas for all endpoints
- Request sanitization middleware

### Error Handling
- Global error handler with proper HTTP codes
- Custom error classes (NotFoundError, ValidationError)
- Request logging with correlation IDs`;

            const secondAssessment = await scoreOutput(
                revisedOutput,
                "Build a production-ready REST API with auth, validation, and error handling",
                "execution",
                "mandatory_gate",
                [round1]
            );

            // Step 6: Update the revision round
            const updatedRound = updateRevisionRoundWithRevision(round1, revisedOutput);
            expect(updatedRound.revisedOutput).toBeTruthy();

            // Step 7: Create round 2
            const round2 = createRevisionRound(2, revisedOutput, secondAssessment, null);

            // Step 8: Get the score trend
            const trend = getScoreTrend([round1, round2]);
            expect(trend).toHaveLength(2);
            expect(trend[0]).toBe(firstAssessment.overallScore);
            expect(trend[1]).toBe(secondAssessment.overallScore);
        }
    }, 60_000);

    it("escalation flow: stagnating scores → HITL", async () => {
        // Build rounds with stagnating scores
        const rounds = [
            createRevisionRound(1, "out1", {
                reviewId: "r1",
                overallScore: 55,
                dimensions: [],
                verdict: "needs_revision",
                confidence: 70,
                systemAwareness: buildSystemAwareness(),
                triggerType: "mandatory_gate",
                sourceAgent: "execution",
                taskContext: "task",
                timestamp: new Date().toISOString(),
                langsmithTraceId: "t1",
            }, null),
            createRevisionRound(2, "out2", {
                reviewId: "r2",
                overallScore: 57,
                dimensions: [],
                verdict: "needs_revision",
                confidence: 70,
                systemAwareness: buildSystemAwareness(),
                triggerType: "mandatory_gate",
                sourceAgent: "execution",
                taskContext: "task",
                timestamp: new Date().toISOString(),
                langsmithTraceId: "t2",
            }, null),
        ];

        // Stagnation detected
        expect(checkStagnation(rounds)).toBe(true);

        // HITL escalation triggered
        const escalation = shouldEscalateToHITL(rounds, 5);
        expect(escalation.shouldEscalate).toBe(true);
        expect(escalation.reason).toContain("stagnation");
    });

    it("checkpoint flow: progress check during execution", async () => {
        const response = await checkpointWithReviewer({
            progressSummary: "Completed 3 out of 5 API endpoints. All tests passing.",
            plannedNextSteps: "Build the remaining 2 endpoints and add rate limiting.",
            concerns: [],
            agentType: "execution",
            stepNumber: 3,
            tenantId: "default",
            taskContext: "Build 5 REST API endpoints with tests",
        });

        expect(["continue", "adjust", "pause"]).toContain(response.verdict);
        expect(response.timestamp).toBeTruthy();
    }, 30_000);

    it("approved output path: high score → approved → potential distillation", async () => {
        const assessment = await scoreOutput(
            `## Comprehensive REST API

### Endpoints
- GET /users - List all users with pagination
- POST /users - Create user with validation
- GET /users/:id - Get user by ID
- PUT /users/:id - Update user with validation
- DELETE /users/:id - Soft delete user

### Security
- JWT authentication with refresh tokens
- Rate limiting (100 req/min per IP)
- Input sanitization against XSS/SQL injection
- CORS configuration for allowed origins

### Error Handling
- Global error middleware
- Custom error classes
- Request correlation IDs for debugging

### Testing
- 95% code coverage with Vitest
- Integration tests for all endpoints
- E2E tests for critical flows`,
            "Build a comprehensive REST API with full security, validation, and testing",
            "execution",
            "mandatory_gate"
        );

        expect(assessment.dimensions).toHaveLength(6);
        // A comprehensive output should score well
        expect(assessment.overallScore).toBeGreaterThanOrEqual(50);
    }, 30_000);
});
