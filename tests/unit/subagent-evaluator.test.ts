/**
 * Level 8 — Sub-agent Evaluator Tests
 *
 * Tests for the sub_agent_efficiency evaluator.
 * Uses real LLM calls — requires OPENAI_API_KEY.
 */

import { describe, it, expect } from "vitest";
import { subAgentEfficiencyEvaluator } from "baseclaw-agent/src/observability/evaluators.js";

// ── Fail fast if API key is missing ─────────────────────
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error(
        "OPENAI_API_KEY is required for sub-agent evaluator tests. No mocks allowed."
    );
}

describe("Level 8 — Sub-agent Efficiency Evaluator", () => {
    it("scores good sub-agent usage positively", async () => {
        const result = await subAgentEfficiencyEvaluator({
            inputs: {
                parentTask:
                    "Explore three different approaches to building a recommendation engine",
            },
            outputs: {
                subAgentCount: 3,
                subAgentTasks: [
                    "Research collaborative filtering approaches",
                    "Research content-based filtering approaches",
                    "Research hybrid recommendation approaches",
                ],
                subAgentResults: [
                    "Collaborative filtering uses user-item interaction matrices...",
                    "Content-based filtering analyzes item features...",
                    "Hybrid approaches combine CF and CBF for better results...",
                ],
                totalDurationMs: 5000,
            },
        });

        expect(result.key).toBe("sub_agent_efficiency");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
        // Good usage should score reasonably well
        expect(result.score).toBeGreaterThanOrEqual(0.4);
        expect(result.comment).toBeTruthy();
    }, 30_000);

    it("scores excessive sub-agent spawning lower", async () => {
        const result = await subAgentEfficiencyEvaluator({
            inputs: {
                parentTask: "What is 2 + 2?",
            },
            outputs: {
                subAgentCount: 5,
                subAgentTasks: [
                    "Calculate 2 + 2 using addition",
                    "Calculate 2 + 2 using counting",
                    "Calculate 2 + 2 using number line",
                    "Calculate 2 + 2 using fingers",
                    "Calculate 2 + 2 using a calculator",
                ],
                subAgentResults: ["4", "4", "4", "4", "4"],
                totalDurationMs: 10000,
            },
        });

        expect(result.key).toBe("sub_agent_efficiency");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
        expect(result.comment).toBeTruthy();
    }, 30_000);

    it("handles case with no sub-agents spawned", async () => {
        const result = await subAgentEfficiencyEvaluator({
            inputs: {
                parentTask: "Build a comprehensive multi-module system",
            },
            outputs: {
                subAgentCount: 0,
                subAgentTasks: [],
                subAgentResults: [],
                totalDurationMs: 1000,
            },
        });

        expect(result.key).toBe("sub_agent_efficiency");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
    }, 30_000);

    it("returns the correct evaluator key", async () => {
        const result = await subAgentEfficiencyEvaluator({
            inputs: { parentTask: "Test task" },
            outputs: { subAgentCount: 1, subAgentTasks: ["Sub task"], subAgentResults: ["Done"], totalDurationMs: 500 },
        });

        expect(result.key).toBe("sub_agent_efficiency");
    }, 30_000);

    it("is included in EVALUATOR_TEMPLATES", async () => {
        const { EVALUATOR_TEMPLATES } = await import(
            "baseclaw-agent/src/observability/evaluators.js"
        );

        expect(EVALUATOR_TEMPLATES).toHaveProperty("sub_agent_efficiency");
        expect(typeof EVALUATOR_TEMPLATES.sub_agent_efficiency).toBe("function");
    });
});
