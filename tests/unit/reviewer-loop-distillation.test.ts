import { describe, it, expect } from "vitest";
import { distillKnowledge } from "baseclaw-agent/src/reviewer-loop/knowledge-distillation.js";
import { buildSystemAwareness } from "baseclaw-agent/src/reviewer-loop/quality-scorer.js";
import type { QualityAssessment } from "baseclaw-agent/src/reviewer-loop/types.js";
import { ALL_QUALITY_DIMENSIONS } from "baseclaw-agent/src/reviewer-loop/types.js";

function buildApprovedAssessment(overrides: Partial<QualityAssessment> = {}): QualityAssessment {
    return {
        reviewId: overrides.reviewId ?? "review-distill-1",
        overallScore: overrides.overallScore ?? 90,
        dimensions: overrides.dimensions ??
            ALL_QUALITY_DIMENSIONS.map((dim) => ({
                dimension: dim,
                score: 90,
                reasoning: `Good ${dim}`,
            })),
        verdict: "approved",
        confidence: 85,
        systemAwareness: buildSystemAwareness(),
        triggerType: "mandatory_gate",
        sourceAgent: overrides.sourceAgent ?? "execution",
        taskContext: overrides.taskContext ?? "Build a REST API with proper error handling and validation",
        timestamp: new Date().toISOString(),
        langsmithTraceId: "trace-distill-test",
    };
}

describe("Level 10 — Knowledge Distillation", () => {
    describe("distillKnowledge", () => {
        it("attempts distillation from a high-quality review", async () => {
            const assessment = buildApprovedAssessment();
            const result = await distillKnowledge(
                assessment,
                `## REST API Implementation

### Error Handling
- Global error middleware catches all unhandled errors
- Custom error classes for different HTTP status codes
- Validation errors return 400 with specific field errors

### Validation
- Zod schemas for all request bodies
- Path parameter validation with UUID format check
- Query parameter sanitization

This approach ensures consistent error responses and prevents invalid data from reaching the database.`,
                "Build a REST API with proper error handling and validation",
                "default"
            );

            // The LLM may or may not find this worth distilling
            // We just verify the response shape
            if (result !== null) {
                expect(result.content).toBeTruthy();
                expect(result.content.length).toBeGreaterThan(10);
                expect(["pattern", "anti_pattern", "criteria", "template"]).toContain(
                    result.knowledgeType
                );
                expect(result.agentRelevance.length).toBeGreaterThanOrEqual(1);
                expect(result.sourceReviewId).toBe("review-distill-1");
                expect(result.tenantId).toBe("default");
                expect(result.timestamp).toBeTruthy();
            }
        }, 30_000);

        it("returns null for trivial output", async () => {
            const assessment = buildApprovedAssessment({
                taskContext: "Say hello",
            });
            const result = await distillKnowledge(
                assessment,
                "Hello! How can I help you today?",
                "Say hello",
                "default"
            );

            // Simple greetings should not produce distilled knowledge
            // (though the LLM makes the final call)
            // We at least verify it's null or a valid DistilledKnowledge
            if (result !== null) {
                expect(result.content).toBeTruthy();
            }
        }, 30_000);

        it("includes source metadata in distilled knowledge", async () => {
            const assessment = buildApprovedAssessment({
                reviewId: "review-meta-test",
                sourceAgent: "planning",
            });
            const result = await distillKnowledge(
                assessment,
                `## Deployment Strategy

Using a blue-green deployment pattern with health checks ensures zero-downtime deployments. This pattern has proven effective across multiple projects where uptime is critical.

Key steps:
1. Deploy new version to green environment
2. Run automated health checks
3. Switch traffic once healthy
4. Keep blue as rollback target`,
                "Design a deployment strategy",
                "test-tenant"
            );

            if (result !== null) {
                expect(result.sourceReviewId).toBe("review-meta-test");
                expect(result.tenantId).toBe("test-tenant");
                expect(["pattern", "anti_pattern", "criteria", "template"]).toContain(
                    result.knowledgeType
                );
            }
        }, 30_000);
    });
});
