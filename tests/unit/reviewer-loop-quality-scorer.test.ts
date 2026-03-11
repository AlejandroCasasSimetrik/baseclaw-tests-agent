import { describe, it, expect } from "vitest";
import { scoreOutput, determineVerdict, buildSystemAwareness } from "baseclaw-agent/src/reviewer-loop/quality-scorer.js";
import { ALL_QUALITY_DIMENSIONS } from "baseclaw-agent/src/reviewer-loop/types.js";

describe("Level 10 — Quality Scorer", () => {
    // ── determineVerdict ───────────────────────────────────

    describe("determineVerdict", () => {
        it("returns 'approved' for scores >= auto-approve threshold", () => {
            expect(
                determineVerdict(85, { autoApproveThreshold: 85, hitlThreshold: 40 })
            ).toBe("approved");
            expect(
                determineVerdict(100, { autoApproveThreshold: 85, hitlThreshold: 40 })
            ).toBe("approved");
        });

        it("returns 'needs_hitl' for scores <= HITL threshold", () => {
            expect(
                determineVerdict(40, { autoApproveThreshold: 85, hitlThreshold: 40 })
            ).toBe("needs_hitl");
            expect(
                determineVerdict(0, { autoApproveThreshold: 85, hitlThreshold: 40 })
            ).toBe("needs_hitl");
        });

        it("returns 'needs_revision' for scores between thresholds", () => {
            expect(
                determineVerdict(60, { autoApproveThreshold: 85, hitlThreshold: 40 })
            ).toBe("needs_revision");
            expect(
                determineVerdict(84, { autoApproveThreshold: 85, hitlThreshold: 40 })
            ).toBe("needs_revision");
            expect(
                determineVerdict(41, { autoApproveThreshold: 85, hitlThreshold: 40 })
            ).toBe("needs_revision");
        });

        it("handles edge case where thresholds are equal", () => {
            expect(
                determineVerdict(50, { autoApproveThreshold: 50, hitlThreshold: 50 })
            ).toBe("approved");
        });

        it("uses default config when none provided", () => {
            const result = determineVerdict(90);
            expect(result).toBe("approved");
        });
    });

    // ── buildSystemAwareness ───────────────────────────────

    describe("buildSystemAwareness", () => {
        it("returns defaults when no input provided", () => {
            const awareness = buildSystemAwareness();
            expect(awareness.activeAgents).toEqual([]);
            expect(awareness.activeSubAgents).toEqual([]);
            expect(awareness.pendingTasks).toBe(0);
            expect(awareness.driftDetected).toBe(false);
            expect(awareness.contradictionDetected).toBe(false);
            expect(awareness.scopeCreepDetected).toBe(false);
            expect(awareness.riskAccumulation).toBe(false);
            expect(awareness.observations).toBe("No issues detected.");
        });

        it("merges partial input with defaults", () => {
            const awareness = buildSystemAwareness({
                driftDetected: true,
                pendingTasks: 5,
            });
            expect(awareness.driftDetected).toBe(true);
            expect(awareness.pendingTasks).toBe(5);
            expect(awareness.contradictionDetected).toBe(false);
        });

        it("uses provided values over defaults", () => {
            const awareness = buildSystemAwareness({
                activeAgents: ["execution", "planning"],
                observations: "drift issue found",
            });
            expect(awareness.activeAgents).toEqual(["execution", "planning"]);
            expect(awareness.observations).toBe("drift issue found");
        });
    });

    // ── scoreOutput (real LLM call) ────────────────────────

    describe("scoreOutput", () => {
        it("produces a valid QualityAssessment with all fields", async () => {
            const assessment = await scoreOutput(
                "Here is a well-structured plan for building a REST API with Express.js...",
                "Create a plan for building a REST API",
                "planning",
                "mandatory_gate"
            );

            // Core fields
            expect(assessment.reviewId).toBeTruthy();
            expect(typeof assessment.overallScore).toBe("number");
            expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
            expect(assessment.overallScore).toBeLessThanOrEqual(100);

            // Dimensions
            expect(assessment.dimensions).toHaveLength(6);
            for (const dim of assessment.dimensions) {
                expect(ALL_QUALITY_DIMENSIONS).toContain(dim.dimension);
                expect(dim.score).toBeGreaterThanOrEqual(0);
                expect(dim.score).toBeLessThanOrEqual(100);
                expect(typeof dim.reasoning).toBe("string");
            }

            // Verdict
            expect(["approved", "needs_revision", "needs_hitl"]).toContain(
                assessment.verdict
            );

            // Confidence
            expect(assessment.confidence).toBeGreaterThanOrEqual(0);
            expect(assessment.confidence).toBeLessThanOrEqual(100);

            // System awareness
            expect(assessment.systemAwareness).toBeDefined();
            expect(typeof assessment.systemAwareness.driftDetected).toBe("boolean");
            expect(typeof assessment.systemAwareness.contradictionDetected).toBe("boolean");

            // Metadata
            expect(assessment.sourceAgent).toBe("planning");
            expect(assessment.triggerType).toBe("mandatory_gate");
            expect(assessment.taskContext).toBe("Create a plan for building a REST API");
            expect(assessment.timestamp).toBeTruthy();
            expect(assessment.langsmithTraceId).toBeTruthy();
        }, 30_000);

        it("scores high-quality output with a high score", async () => {
            const assessment = await scoreOutput(
                `# REST API Plan

## 1. Project Setup
- Initialize Node.js project with TypeScript
- Install Express, cors, helmet, and validation libraries
- Set up project structure: src/controllers, src/routes, src/middleware

## 2. Database Layer
- Design PostgreSQL schema with users, posts tables
- Set up Drizzle ORM with migrations
- Create repository pattern for data access

## 3. API Implementation
- Implement CRUD endpoints for all resources
- Add input validation with Zod schemas
- Implement JWT authentication middleware

## 4. Testing & Deployment
- Write integration tests with Vitest
- Set up CI/CD pipeline
- Deploy to Railway with environment config

This plan covers all requirements and follows RESTful best practices.`,
                "Create a detailed plan for building a REST API with user authentication",
                "planning",
                "mandatory_gate"
            );

            expect(assessment.overallScore).toBeGreaterThanOrEqual(50);
        }, 30_000);

        it("includes review history context when provided", async () => {
            const previousRound = {
                roundNumber: 1,
                originalOutput: "incomplete plan",
                assessment: {
                    reviewId: "prev-1",
                    overallScore: 55,
                    dimensions: [],
                    verdict: "needs_revision" as const,
                    confidence: 70,
                    systemAwareness: buildSystemAwareness(),
                    triggerType: "mandatory_gate" as const,
                    sourceAgent: "planning" as const,
                    taskContext: "test",
                    timestamp: new Date().toISOString(),
                    langsmithTraceId: "trace-prev",
                },
                feedback: null,
                revisedOutput: null,
                timestamp: new Date().toISOString(),
            };

            const assessment = await scoreOutput(
                "Improved plan with more details...",
                "Create a plan",
                "planning",
                "mandatory_gate",
                [previousRound]
            );

            expect(assessment.reviewId).toBeTruthy();
            expect(assessment.dimensions).toHaveLength(6);
        }, 30_000);
    });
});
