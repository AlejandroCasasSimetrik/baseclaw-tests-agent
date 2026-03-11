import { describe, it, expect } from "vitest";
import {
    conversationSkills,
    contextSummarization,
    codeExplanation,
    taskBreakdown,
    dataAnalysis,
} from "baseclaw-agent/src/skills/builtin/conversation.js";
import type { SkillDefinition } from "baseclaw-agent/src/skills/types.js";

describe("Conversation Built-in Skills", () => {
    // ── Array Integrity ────────────────────────────────────

    describe("conversationSkills array", () => {
        it("is a non-empty array", () => {
            expect(Array.isArray(conversationSkills)).toBe(true);
            expect(conversationSkills.length).toBeGreaterThan(0);
        });

        it("contains only SkillDefinition objects", () => {
            for (const skill of conversationSkills) {
                expect(skill.id).toBeTruthy();
                expect(skill.name).toBeTruthy();
                expect(skill.description).toBeTruthy();
                expect(typeof skill.handler).toBe("function");
                expect(typeof skill.relevanceScorer).toBe("function");
                expect(typeof skill.systemPromptFragment).toBe("string");
            }
        });

        it("has unique IDs across all conversation skills", () => {
            const ids = conversationSkills.map((s) => s.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it("all IDs start with 'conversation.'", () => {
            for (const skill of conversationSkills) {
                expect(skill.id.startsWith("conversation.")).toBe(true);
            }
        });

        it("all skills have category 'conversation'", () => {
            for (const skill of conversationSkills) {
                expect(skill.category).toBe("conversation");
            }
        });
    });

    // ── Agent Type Assignments ─────────────────────────────

    describe("agent type assignments", () => {
        it("all skills include 'conversation' in agentTypes", () => {
            for (const skill of conversationSkills) {
                expect(
                    skill.agentTypes.includes("conversation"),
                    `${skill.id} missing 'conversation' agent type`
                ).toBe(true);
            }
        });

        it("contextSummarization is available to reviewer", () => {
            expect(contextSummarization.agentTypes).toContain("reviewer");
        });

        it("codeExplanation is available to execution", () => {
            expect(codeExplanation.agentTypes).toContain("execution");
        });

        it("taskBreakdown is available to planning", () => {
            expect(taskBreakdown.agentTypes).toContain("planning");
        });

        it("dataAnalysis is available to execution", () => {
            expect(dataAnalysis.agentTypes).toContain("execution");
        });

        it("all agentTypes are valid enum values", () => {
            const validTypes = ["conversation", "ideation", "planning", "execution", "reviewer"];
            for (const skill of conversationSkills) {
                for (const t of skill.agentTypes) {
                    expect(validTypes).toContain(t);
                }
            }
        });
    });

    // ── System Prompt Fragments ────────────────────────────

    describe("system prompt fragments", () => {
        it("all fragments are substantial (>50 chars)", () => {
            for (const skill of conversationSkills) {
                expect(
                    skill.systemPromptFragment.length,
                    `${skill.id} has too short a prompt fragment`
                ).toBeGreaterThan(50);
            }
        });

        it("contextSummarization mentions summarizing", () => {
            const lower = contextSummarization.systemPromptFragment.toLowerCase();
            expect(lower).toContain("summar");
        });

        it("codeExplanation mentions code", () => {
            const lower = codeExplanation.systemPromptFragment.toLowerCase();
            expect(lower).toContain("code");
        });

        it("taskBreakdown mentions steps or decompose", () => {
            const lower = taskBreakdown.systemPromptFragment.toLowerCase();
            const hasTerm = lower.includes("step") || lower.includes("decompose") || lower.includes("break");
            expect(hasTerm).toBe(true);
        });

        it("dataAnalysis mentions data or analysis", () => {
            const lower = dataAnalysis.systemPromptFragment.toLowerCase();
            const hasTerm = lower.includes("data") || lower.includes("analy");
            expect(hasTerm).toBe(true);
        });
    });

    // ── Handlers ───────────────────────────────────────────

    describe("handlers", () => {
        it("all handlers return valid SkillResult objects", async () => {
            for (const skill of conversationSkills) {
                const result = await skill.handler({
                    taskContext: "test context for conversation",
                    agentType: "conversation",
                    messages: [],
                });

                expect(result).toBeDefined();
                expect(typeof result.output).toBe("string");
                expect(result.output.length).toBeGreaterThan(0);
            }
        });

        it("handler output references the task context", async () => {
            for (const skill of conversationSkills) {
                const result = await skill.handler({
                    taskContext: "build a dashboard",
                    agentType: "conversation",
                    messages: [],
                });
                expect(result.output).toContain("build a dashboard");
            }
        });
    });

    // ── Relevance Scorers ──────────────────────────────────

    describe("relevance scorers", () => {
        it("all scorers return numbers between 0 and 1", () => {
            for (const skill of conversationSkills) {
                const score = skill.relevanceScorer("conversation", "generic text");
                expect(score).toBeGreaterThanOrEqual(0);
                expect(score).toBeLessThanOrEqual(1);
            }
        });

        it("all scorers return low value for empty context", () => {
            for (const skill of conversationSkills) {
                const score = skill.relevanceScorer("conversation", "");
                expect(score).toBeLessThan(0.5);
            }
        });

        it("contextSummarization scores high for summary-related context", () => {
            const score = contextSummarization.relevanceScorer(
                "conversation",
                "summarize this document and give me the key points overview"
            );
            expect(score).toBeGreaterThan(0.3);
        });

        it("codeExplanation scores high for code-related context", () => {
            const score = codeExplanation.relevanceScorer(
                "conversation",
                "explain this function class and debug the error"
            );
            expect(score).toBeGreaterThan(0.3);
        });

        it("taskBreakdown scores high for planning-related context", () => {
            const score = taskBreakdown.relevanceScorer(
                "conversation",
                "help me build and create a plan with steps to deploy"
            );
            expect(score).toBeGreaterThan(0.3);
        });

        it("dataAnalysis scores high for data-related context", () => {
            const score = dataAnalysis.relevanceScorer(
                "conversation",
                "analyze the data and compare the statistics metrics"
            );
            expect(score).toBeGreaterThan(0.3);
        });
    });
});
