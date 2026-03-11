import { describe, it, expect, beforeAll } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { buildGraph } from "baseclaw-agent/src/graph.js";

/**
 * Integration tests — real API calls, no mocks.
 * Tests the full graph invocation flow end-to-end.
 *
 * Requires: OPENAI_API_KEY in .env
 * Timeout: 60s per test (LLM calls + middleware memory loading)
 *
 * NOTE: Specialist agents now preserve their identity in currentAgent
 * and set lastSpecialistAgent. The conversation wrap-up no longer
 * resets currentAgent to "conversation" when a specialist handled it.
 */

describe("End-to-End Routing", { timeout: 120_000 }, () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-your-openai-api-key") {
            throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
        }
    });

    const graph = buildGraph();

    it("general chat stays in conversation and responds", async () => {
        const result = await graph.invoke(
            { messages: [new HumanMessage("Hello, who are you?")] },
            { recursionLimit: 50 }
        );

        // Should have at least one AI response
        const aiMessages = result.messages.filter(
            (m: any) => m._getType() === "ai"
        );
        expect(aiMessages.length).toBeGreaterThanOrEqual(1);

        // Should end in conversation phase
        expect(result.phase).toBe("conversation");
    });

    it("ideation intent routes to ideation agent and back", async () => {
        const result = await graph.invoke(
            {
                messages: [
                    new HumanMessage(
                        "I have an idea for an AI-powered gardening assistant"
                    ),
                ],
            },
            { recursionLimit: 50 }
        );

        const aiMessages = result.messages.filter(
            (m: any) => m._getType() === "ai"
        );
        expect(aiMessages.length).toBeGreaterThanOrEqual(1);

        // Specialist preserves identity — lastSpecialistAgent should be set
        // to a non-conversation agent (ideation or possibly another specialist)
        const specialist = result.lastSpecialistAgent || result.currentAgent;
        expect(specialist).toBeTruthy();
        expect(specialist).not.toBe("conversation");
    });

    it("planning intent routes to planning agent and back", async () => {
        const result = await graph.invoke(
            {
                messages: [
                    new HumanMessage(
                        "Create a detailed plan for building a mobile app"
                    ),
                ],
            },
            { recursionLimit: 50 }
        );

        const aiMessages = result.messages.filter(
            (m: any) => m._getType() === "ai"
        );
        expect(aiMessages.length).toBeGreaterThanOrEqual(1);

        // Should have been handled by a specialist (planning or re-routed)
        const specialist = result.lastSpecialistAgent || result.currentAgent;
        expect(specialist).toBeTruthy();
        expect(specialist).not.toBe("conversation");
    });

    it("execution intent routes to execution agent and back", async () => {
        const result = await graph.invoke(
            {
                messages: [
                    new HumanMessage("Implement a function that reverses a string"),
                ],
            },
            { recursionLimit: 50 }
        );

        const aiMessages = result.messages.filter(
            (m: any) => m._getType() === "ai"
        );
        expect(aiMessages.length).toBeGreaterThanOrEqual(1);

        // Should have been handled by a specialist (execution or re-routed)
        const specialist = result.lastSpecialistAgent || result.currentAgent;
        expect(specialist).toBeTruthy();
        expect(specialist).not.toBe("conversation");
    });

    it("review intent routes to reviewer agent and back", async () => {
        const result = await graph.invoke(
            {
                messages: [
                    new HumanMessage(
                        "Review this code for quality issues and potential bugs"
                    ),
                ],
            },
            { recursionLimit: 50 }
        );

        const aiMessages = result.messages.filter(
            (m: any) => m._getType() === "ai"
        );
        expect(aiMessages.length).toBeGreaterThanOrEqual(1);

        // Should have been handled by a specialist (reviewer or re-routed)
        const specialist = result.lastSpecialistAgent || result.currentAgent;
        expect(specialist).toBeTruthy();
        expect(specialist).not.toBe("conversation");
    });
});

describe("Iteration Safety (live)", { timeout: 120_000 }, () => {
    it("respects custom maxIterations", async () => {
        const graph = buildGraph();

        const result = await graph.invoke(
            {
                messages: [new HumanMessage("Hello!")],
                maxIterations: 3,
            },
            { recursionLimit: 50 }
        );

        // Should complete within limit
        expect(result.iterationCount).toBeLessThanOrEqual(4); // 3 + 1 for the limit check
    });
});

describe("Response Quality", { timeout: 120_000 }, () => {
    it("responses are non-empty strings", async () => {
        const graph = buildGraph();

        const result = await graph.invoke(
            { messages: [new HumanMessage("Tell me about yourself.")] },
            { recursionLimit: 50 }
        );

        const lastAi = [...result.messages]
            .reverse()
            .find((m: any) => m._getType() === "ai");

        expect(lastAi).toBeDefined();
        expect(String(lastAi!.content).length).toBeGreaterThan(10);
    });

    it("taskContext is populated after routing", async () => {
        const graph = buildGraph();

        const result = await graph.invoke(
            {
                messages: [
                    new HumanMessage("Brainstorm ideas for a new social media platform"),
                ],
            },
            { recursionLimit: 50 }
        );

        // taskContext should be set by the conversation agent
        expect(result.taskContext).toBeTruthy();
        expect(result.taskContext.length).toBeGreaterThan(5);
    });
});
