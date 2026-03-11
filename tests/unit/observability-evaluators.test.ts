import { describe, it, expect } from "vitest";
import {
    skillRelevanceEvaluator,
    EVALUATOR_TEMPLATES,
} from "baseclaw-agent/src/observability/evaluators.js";
import type { EvaluatorInput } from "baseclaw-agent/src/observability/evaluators.js";

describe("Evaluators (Level 4)", () => {
    // ── EVALUATOR_TEMPLATES registry ────────────────────────

    it("includes all 14 evaluator templates", () => {
        expect(Object.keys(EVALUATOR_TEMPLATES)).toHaveLength(14);
        expect(EVALUATOR_TEMPLATES.routing_accuracy).toBeDefined();
        expect(EVALUATOR_TEMPLATES.skill_relevance).toBeDefined();
        expect(EVALUATOR_TEMPLATES.memory_retrieval_quality).toBeDefined();
        expect(EVALUATOR_TEMPLATES.response_quality).toBeDefined();
        expect(EVALUATOR_TEMPLATES.rag_retrieval_quality).toBeDefined();
        expect(EVALUATOR_TEMPLATES.mcp_tool_accuracy).toBeDefined();
        expect(EVALUATOR_TEMPLATES.sub_agent_efficiency).toBeDefined();
        expect(EVALUATOR_TEMPLATES.review_consistency).toBeDefined();
        expect(EVALUATOR_TEMPLATES.feedback_actionability).toBeDefined();
        expect(EVALUATOR_TEMPLATES.revision_improvement).toBeDefined();
        expect(EVALUATOR_TEMPLATES.distillation_quality).toBeDefined();
        expect(EVALUATOR_TEMPLATES.mandatory_gate_coverage).toBeDefined();
        expect(EVALUATOR_TEMPLATES.drift_detection_accuracy).toBeDefined();
        expect(EVALUATOR_TEMPLATES.checkpoint_responsiveness).toBeDefined();
    });

    it("all evaluators are callable functions", () => {
        for (const fn of Object.values(EVALUATOR_TEMPLATES)) {
            expect(typeof fn).toBe("function");
        }
    });

    // ── skillRelevanceEvaluator (heuristic — no LLM needed) ─

    it("scores skill relevance with matching keywords", async () => {
        const input: EvaluatorInput = {
            inputs: { taskContext: "brainstorm ideas for mobile app" },
            outputs: { skillsLoaded: ["brainstorming", "question-generation"] },
            referenceOutputs: { expectedSkills: ["brainstorming", "question-generation"] },
        };

        const result = await skillRelevanceEvaluator(input);
        expect(result.key).toBe("skill_relevance");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
        expect(result.score).toBe(1.0); // Perfect match
    });

    it("scores 0 for completely mismatched skills", async () => {
        const input: EvaluatorInput = {
            inputs: { taskContext: "brainstorm ideas" },
            outputs: { skillsLoaded: ["code-generation"] },
            referenceOutputs: { expectedSkills: ["brainstorming"] },
        };

        const result = await skillRelevanceEvaluator(input);
        expect(result.key).toBe("skill_relevance");
        expect(result.score).toBe(0); // No overlap
    });

    it("scores partial match correctly", async () => {
        const input: EvaluatorInput = {
            inputs: { taskContext: "plan a project" },
            outputs: { skillsLoaded: ["planning", "estimation"] },
            referenceOutputs: { expectedSkills: ["planning", "risk-assessment"] },
        };

        const result = await skillRelevanceEvaluator(input);
        expect(result.key).toBe("skill_relevance");
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThan(1);
    });

    it("handles no reference outputs gracefully", async () => {
        const input: EvaluatorInput = {
            inputs: { taskContext: "brainstorm ideas for mobile app" },
            outputs: { skillsLoaded: ["brainstorming"] },
        };

        const result = await skillRelevanceEvaluator(input);
        expect(result.key).toBe("skill_relevance");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
    });

    it("handles empty skills loaded", async () => {
        const input: EvaluatorInput = {
            inputs: { taskContext: "do something" },
            outputs: { skillsLoaded: [] },
        };

        const result = await skillRelevanceEvaluator(input);
        expect(result.key).toBe("skill_relevance");
        expect(result.score).toBe(0.5); // No skills = neutral
    });

    // ── Evaluator result structure ──────────────────────────

    it("skill evaluator returns proper EvaluatorResult structure", async () => {
        const input: EvaluatorInput = {
            inputs: { taskContext: "test" },
            outputs: { skillsLoaded: ["test-skill"] },
        };

        const result = await skillRelevanceEvaluator(input);
        expect(result).toHaveProperty("key");
        expect(result).toHaveProperty("score");
        expect(typeof result.key).toBe("string");
        expect(typeof result.score).toBe("number");
    });
});
