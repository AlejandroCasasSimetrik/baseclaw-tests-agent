/**
 * Level 5 — RAG Evaluator Tests (Real LLM)
 *
 * Tests the rag_retrieval_quality evaluator with real ChatOpenAI calls.
 * OPENAI_API_KEY required — fails immediately if missing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ragRetrievalQualityEvaluator } from "baseclaw-agent/src/observability/evaluators.js";

describe("Level 5 — RAG Retrieval Quality Evaluator", { timeout: 30_000 }, () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
        }
    });

    it("scores relevant chunks highly", async () => {
        const result = await ragRetrievalQualityEvaluator({
            inputs: { query: "What are the Q4 sales figures?" },
            outputs: {
                chunks: [
                    { text: "Q4 sales were $2.3M, up 15% from Q3." },
                    { text: "Revenue breakdown: Product A: $1.2M, Product B: $1.1M" },
                ],
            },
        });

        expect(result.key).toBe("rag_retrieval_quality");
        expect(result.score).toBeGreaterThanOrEqual(0.5);
        expect(result.score).toBeLessThanOrEqual(1.0);
        expect(result.comment).toBeTruthy();
    });

    it("scores irrelevant chunks low", async () => {
        const result = await ragRetrievalQualityEvaluator({
            inputs: { query: "What is the company valuation?" },
            outputs: {
                chunks: [{ text: "Recipe for chocolate cake: Mix flour and sugar..." }],
            },
        });

        expect(result.score).toBeLessThanOrEqual(0.5);
    });

    it("handles empty chunks", async () => {
        const result = await ragRetrievalQualityEvaluator({
            inputs: { query: "Some query" },
            outputs: { chunks: [] },
        });

        expect(result.score).toBeLessThanOrEqual(0.3);
    });

    it("clamps scores between 0 and 1", async () => {
        const result = await ragRetrievalQualityEvaluator({
            inputs: { query: "test query" },
            outputs: { chunks: [{ text: "test data" }] },
        });

        expect(result.score).toBeLessThanOrEqual(1.0);
        expect(result.score).toBeGreaterThanOrEqual(0.0);
    });

    it("is registered in EVALUATOR_TEMPLATES", async () => {
        const { EVALUATOR_TEMPLATES } = await import("../../src/observability/evaluators.js");
        expect(EVALUATOR_TEMPLATES).toHaveProperty("rag_retrieval_quality");
        expect(typeof EVALUATOR_TEMPLATES.rag_retrieval_quality).toBe("function");
    });
});
