import { describe, it, expect, beforeAll } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { buildGraph } from "baseclaw-agent/src/graph.js";

/**
 * Level 4 — Multi-Agent LangSmith Trace Integration Tests
 *
 * These tests exercise the FULL multi-agent round-trip:
 *   __start__ → conversation (classify) → specialist → conversation → __end__
 *
 * Real API calls, no mocks. OPENAI_API_KEY required.
 * Timeout: 60s per test (multi-hop routes take longer)
 *
 * Run: npx vitest run tests/integration/observability-multi-agent.test.ts
 */

describe(
    "Multi-Agent Traces (Level 4 — Observability)",
    { timeout: 120_000 },
    () => {
        beforeAll(() => {
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-your-openai-api-key") {
                throw new Error("OPENAI_API_KEY is required. Set it in .env to run tests.");
            }
        });

        const graph = buildGraph();

        // ── Helpers ────────────────────────────────────────────
        function getAIMessages(result: any) {
            return result.messages.filter(
                (m: any) => m._getType() === "ai"
            );
        }

        function getLastAIContent(result: any): string {
            const aiMsgs = getAIMessages(result);
            const last = aiMsgs[aiMsgs.length - 1];
            return last ? String(last.content) : "";
        }

        // ── Ideation Agent full round-trip ─────────────────────
        it("ideation agent produces substantive brainstorming output", async () => {
            const result = await graph.invoke(
                {
                    messages: [
                        new HumanMessage(
                            "I need creative ideas for a gamified language learning app"
                        ),
                    ],
                },
                { recursionLimit: 50 }
            );

            const aiMessages = getAIMessages(result);
            const content = getLastAIContent(result);

            // Specialist responded with real output
            expect(aiMessages.length).toBeGreaterThanOrEqual(1);
            expect(content.length).toBeGreaterThan(20);

            // Route happened: taskContext was populated and state tracked the hops
            expect(result.taskContext).toBeTruthy();
            expect(result.iterationCount).toBeGreaterThanOrEqual(2);

            // Specialist preserved identity — should not be "conversation"
            const specialist = result.lastSpecialistAgent || result.currentAgent;
            expect(specialist).not.toBe("conversation");
            expect(result.phase).toBe("conversation");
        });

        // ── Planning Agent full round-trip ─────────────────────
        it("planning agent produces a structured plan", async () => {
            const result = await graph.invoke(
                {
                    messages: [
                        new HumanMessage(
                            "Create a 3-step project plan for building a weather dashboard"
                        ),
                    ],
                },
                { recursionLimit: 50 }
            );

            const aiMessages = getAIMessages(result);
            const content = getLastAIContent(result);

            expect(aiMessages.length).toBeGreaterThanOrEqual(1);
            expect(content.length).toBeGreaterThan(20);

            // Plan should contain structure indicators
            const hasStructure =
                content.includes("1") ||
                content.includes("Step") ||
                content.includes("Phase") ||
                content.includes("•") ||
                content.includes("-");
            expect(hasStructure).toBe(true);

            expect(result.taskContext).toBeTruthy();
            const specialist = result.lastSpecialistAgent || result.currentAgent;
            expect(specialist).not.toBe("conversation");
        });

        // ── Execution Agent full round-trip ────────────────────
        it("execution agent produces code or implementation output", async () => {
            const result = await graph.invoke(
                {
                    messages: [
                        new HumanMessage(
                            "Write a TypeScript function that validates email addresses using regex"
                        ),
                    ],
                },
                { recursionLimit: 50 }
            );

            const aiMessages = getAIMessages(result);
            const content = getLastAIContent(result);

            expect(aiMessages.length).toBeGreaterThanOrEqual(1);
            expect(content.length).toBeGreaterThan(10);

            // Should contain code-like content
            const hasCode =
                content.includes("function") ||
                content.includes("const") ||
                content.includes("=>") ||
                content.includes("return") ||
                content.includes("regex") ||
                content.includes("RegExp");
            expect(hasCode).toBe(true);

            expect(result.taskContext).toBeTruthy();
            const specialist = result.lastSpecialistAgent || result.currentAgent;
            expect(specialist).not.toBe("conversation");
        });

        // ── Reviewer Agent full round-trip ─────────────────────
        it("reviewer agent produces review feedback", async () => {
            const result = await graph.invoke(
                {
                    messages: [
                        new HumanMessage(
                            "Review the following code for bugs and improvements:\n\nfunction add(a, b) { return a + b }\nfunction divide(a, b) { return a / b }"
                        ),
                    ],
                },
                { recursionLimit: 50 }
            );

            const aiMessages = getAIMessages(result);
            const content = getLastAIContent(result);

            expect(aiMessages.length).toBeGreaterThanOrEqual(1);
            expect(content.length).toBeGreaterThan(10);

            // Should contain review-like feedback
            const hasReview =
                content.toLowerCase().includes("bug") ||
                content.toLowerCase().includes("error") ||
                content.toLowerCase().includes("improve") ||
                content.toLowerCase().includes("issue") ||
                content.toLowerCase().includes("suggest") ||
                content.toLowerCase().includes("division") ||
                content.toLowerCase().includes("zero") ||
                content.toLowerCase().includes("type");
            expect(hasReview).toBe(true);

            expect(result.taskContext).toBeTruthy();
            const specialist = result.lastSpecialistAgent || result.currentAgent;
            expect(specialist).not.toBe("conversation");
        });

        // ── State integrity across multi-hop ──────────────────
        it("state is properly updated through the full routing cycle", async () => {
            const result = await graph.invoke(
                {
                    messages: [
                        new HumanMessage(
                            "Help me brainstorm unique features for a pet adoption platform"
                        ),
                    ],
                },
                { recursionLimit: 50 }
            );

            // Full cycle completed — specialist preserves identity
            const specialist = result.lastSpecialistAgent || result.currentAgent;
            expect(specialist).not.toBe("conversation");
            expect(result.phase).toBe("conversation");

            // Task context was set during routing
            expect(result.taskContext).toBeTruthy();
            expect(result.taskContext.length).toBeGreaterThan(5);

            // Iteration count tracks the hops
            // Minimum 2: conversation (classify + route) → specialist → conversation (format)
            expect(result.iterationCount).toBeGreaterThanOrEqual(2);

            // Max iterations was maintained
            expect(result.maxIterations).toBe(25);

            // Messages: 1 human input + at least 1 AI response
            const humanMsgs = result.messages.filter(
                (m: any) => m._getType() === "human"
            );
            const aiMsgs = getAIMessages(result);
            expect(humanMsgs.length).toBe(1);
            expect(aiMsgs.length).toBeGreaterThanOrEqual(1);

            // The AI response is substantive
            const content = getLastAIContent(result);
            expect(content.length).toBeGreaterThan(50);
        });

        // ── All agents respond without hanging ────────────────
        it("all 4 specialist agents complete without hanging", async () => {
            const prompts: [string, string][] = [
                ["ideation", "Brainstorm monetization strategies for a note-taking app"],
                ["planning", "Outline a deployment plan for a containerized microservice"],
                ["execution", "Write a function to flatten a nested array in JavaScript"],
                ["review", "Review this SQL query for performance: SELECT * FROM users WHERE created_at > '2024-01-01'"],
            ];

            const results = await Promise.all(
                prompts.map(([_label, msg]) =>
                    graph.invoke(
                        { messages: [new HumanMessage(msg)] },
                        { recursionLimit: 50 }
                    )
                )
            );

            for (let i = 0; i < results.length; i++) {
                const [label] = prompts[i];
                const result = results[i];
                const content = getLastAIContent(result);

                // Each specialist must have produced substantive output
                expect(
                    content.length,
                    `${label}: expected substantive response`
                ).toBeGreaterThan(20);

                // Specialist preserved identity
                const specialist = result.lastSpecialistAgent || result.currentAgent;
                expect(
                    specialist,
                    `${label}: should have been handled by a specialist`
                ).not.toBe("conversation");

                // Task context was set (proves routing happened)
                expect(
                    result.taskContext,
                    `${label}: taskContext should be set`
                ).toBeTruthy();
            }
        });

        // ── Conversation agent stays for chat ─────────────────
        it("conversation agent handles general chat without routing", async () => {
            const result = await graph.invoke(
                {
                    messages: [
                        new HumanMessage("What's your name and what can you do?"),
                    ],
                },
                { recursionLimit: 50 }
            );

            const aiMessages = getAIMessages(result);
            const content = getLastAIContent(result);

            // Only 1 AI message (direct response, no specialist hop)
            expect(aiMessages.length).toBe(1);
            expect(content.length).toBeGreaterThan(20);

            // Stayed in conversation
            expect(result.currentAgent).toBe("conversation");
            expect(result.phase).toBe("conversation");

            // Iteration count is just 1 (no specialist hop)
            expect(result.iterationCount).toBe(1);
        });
    }
);
