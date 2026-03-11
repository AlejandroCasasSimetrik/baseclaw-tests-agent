import { describe, it, expect, beforeEach } from "vitest";
import { SkillRegistry } from "baseclaw-agent/src/skills/registry.js";
import {
    registerCustomSkill,
    exampleSentimentSkill,
} from "baseclaw-agent/src/skills/custom.js";
import type { SkillDefinition, AgentType } from "baseclaw-agent/src/skills/types.js";

describe("Custom Skills", () => {
    let registry: SkillRegistry;

    beforeEach(() => {
        registry = new SkillRegistry();
    });

    // ── registerCustomSkill() ───────────────────────────────

    describe("registerCustomSkill()", () => {
        it("registers a valid custom skill", () => {
            registerCustomSkill(registry, exampleSentimentSkill);
            expect(
                registry.getSkill("custom.sentiment-analysis")
            ).toBeDefined();
        });

        it("custom skill follows same interface as built-in", () => {
            const skill = exampleSentimentSkill;

            // All required fields present
            expect(typeof skill.id).toBe("string");
            expect(typeof skill.name).toBe("string");
            expect(typeof skill.description).toBe("string");
            expect(Array.isArray(skill.agentTypes)).toBe(true);
            expect(skill.agentTypes.length).toBeGreaterThan(0);
            expect(typeof skill.handler).toBe("function");
            expect(typeof skill.relevanceScorer).toBe("function");
            expect(typeof skill.systemPromptFragment).toBe("string");
        });

        it("throws when missing id", () => {
            const bad = { ...exampleSentimentSkill, id: "" };
            expect(() =>
                registerCustomSkill(registry, bad as SkillDefinition)
            ).toThrow("missing required fields");
        });

        it("throws when missing name", () => {
            const bad = { ...exampleSentimentSkill, name: "" };
            expect(() =>
                registerCustomSkill(registry, bad as SkillDefinition)
            ).toThrow("missing required fields");
        });

        it("throws when missing description", () => {
            const bad = { ...exampleSentimentSkill, description: "" };
            expect(() =>
                registerCustomSkill(registry, bad as SkillDefinition)
            ).toThrow("missing required fields");
        });

        it("throws when agentTypes is empty", () => {
            const bad = { ...exampleSentimentSkill, agentTypes: [] as AgentType[] };
            expect(() =>
                registerCustomSkill(registry, bad as SkillDefinition)
            ).toThrow("at least one agentType");
        });

        it("throws when handler is not a function", () => {
            const bad = {
                ...exampleSentimentSkill,
                handler: "not a function" as any,
            };
            expect(() =>
                registerCustomSkill(registry, bad as SkillDefinition)
            ).toThrow("handler function");
        });

        it("throws when relevanceScorer is not a function", () => {
            const bad = {
                ...exampleSentimentSkill,
                relevanceScorer: 0.5 as any,
            };
            expect(() =>
                registerCustomSkill(registry, bad as SkillDefinition)
            ).toThrow("relevanceScorer function");
        });

        it("throws when systemPromptFragment is missing", () => {
            const bad = {
                ...exampleSentimentSkill,
                systemPromptFragment: "",
            };
            expect(() =>
                registerCustomSkill(registry, bad as SkillDefinition)
            ).toThrow("systemPromptFragment");
        });
    });

    // ── Example Sentiment Skill ─────────────────────────────

    describe("exampleSentimentSkill", () => {
        it("has correct agent types", () => {
            expect(exampleSentimentSkill.agentTypes).toContain("reviewer");
            expect(exampleSentimentSkill.agentTypes).toContain("conversation");
        });

        it("handler returns valid result for positive text", async () => {
            const result = await exampleSentimentSkill.handler({
                taskContext: "This is great and I love it",
                agentType: "reviewer",
                messages: [],
            });

            expect(result.output).toContain("positive");
            expect(result.metadata?.sentiment).toBe("positive");
        });

        it("handler returns valid result for negative text", async () => {
            const result = await exampleSentimentSkill.handler({
                taskContext: "This is terrible and I hate it",
                agentType: "reviewer",
                messages: [],
            });

            expect(result.output).toContain("negative");
            expect(result.metadata?.sentiment).toBe("negative");
        });

        it("handler returns neutral for balanced text", async () => {
            const result = await exampleSentimentSkill.handler({
                taskContext: "The meeting is on Tuesday",
                agentType: "reviewer",
                messages: [],
            });

            expect(result.output).toContain("neutral");
            expect(result.metadata?.sentiment).toBe("neutral");
        });

        it("relevance scorer returns high for sentiment-related words", () => {
            const score = exampleSentimentSkill.relevanceScorer(
                "reviewer",
                "analyze the sentiment and emotion of this text"
            );
            expect(score).toBeGreaterThan(0.3);
        });

        it("relevance scorer returns low for unrelated context", () => {
            const score = exampleSentimentSkill.relevanceScorer(
                "reviewer",
                "build a database schema"
            );
            expect(score).toBe(0);
        });

        it("is accessible via registry after registration", () => {
            registerCustomSkill(registry, exampleSentimentSkill);

            // Available to reviewer agent
            const reviewerSkills = registry.getSkillsForAgent("reviewer");
            expect(reviewerSkills.some((s) => s.id === "custom.sentiment-analysis")).toBe(true);

            // Available to conversation agent
            const convSkills = registry.getSkillsForAgent("conversation");
            expect(convSkills.some((s) => s.id === "custom.sentiment-analysis")).toBe(true);
        });
    });

    // ── Plug-and-Play Pattern ───────────────────────────────

    describe("plug-and-play pattern", () => {
        it("custom skill can be registered alongside built-in skills", () => {
            // Simulate built-in registration
            registry.register({
                id: "builtin.test",
                name: "Built-in Test",
                description: "A built-in skill",
                agentTypes: ["reviewer"],
                handler: async () => ({ output: "built-in" }),
                relevanceScorer: () => 0.5,
                systemPromptFragment: "Built-in instructions",
            });

            // Register custom skill
            registerCustomSkill(registry, exampleSentimentSkill);

            // Both are accessible
            expect(registry.size).toBe(2);
            expect(registry.getSkill("builtin.test")).toBeDefined();
            expect(
                registry.getSkill("custom.sentiment-analysis")
            ).toBeDefined();
        });

        it("custom skill can be unregistered at runtime", () => {
            registerCustomSkill(registry, exampleSentimentSkill);
            expect(registry.size).toBe(1);

            registry.unregister("custom.sentiment-analysis");
            expect(registry.size).toBe(0);
        });
    });
});
