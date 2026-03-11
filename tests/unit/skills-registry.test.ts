import { describe, it, expect, beforeEach } from "vitest";
import { SkillRegistry } from "baseclaw-agent/src/skills/registry.js";
import type { SkillDefinition, AgentType } from "baseclaw-agent/src/skills/types.js";

/** Helper to create a minimal valid skill for testing */
function makeSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
    return {
        id: "test.skill",
        name: "Test Skill",
        description: "A test skill",
        agentTypes: ["ideation"] as AgentType[],
        handler: async () => ({ output: "test output" }),
        relevanceScorer: () => 0.5,
        systemPromptFragment: "Test prompt fragment",
        ...overrides,
    };
}

describe("SkillRegistry", () => {
    let registry: SkillRegistry;

    beforeEach(() => {
        registry = new SkillRegistry();
    });

    // ── Registration ────────────────────────────────────────

    describe("register()", () => {
        it("registers a skill successfully", () => {
            const skill = makeSkill();
            registry.register(skill);
            expect(registry.size).toBe(1);
            expect(registry.getSkill("test.skill")).toBe(skill);
        });

        it("throws on duplicate skill ID", () => {
            registry.register(makeSkill());
            expect(() => registry.register(makeSkill())).toThrow(
                'Skill "test.skill" is already registered'
            );
        });

        it("registers multiple skills with different IDs", () => {
            registry.register(makeSkill({ id: "skill.a" }));
            registry.register(makeSkill({ id: "skill.b" }));
            registry.register(makeSkill({ id: "skill.c" }));
            expect(registry.size).toBe(3);
        });

        it("supports runtime registration (same as startup)", () => {
            // Built-in skill at "startup"
            registry.register(makeSkill({ id: "builtin.a" }));
            expect(registry.size).toBe(1);

            // Custom skill at "runtime"
            registry.register(makeSkill({ id: "custom.a" }));
            expect(registry.size).toBe(2);

            // Both are equally accessible
            expect(registry.getSkill("builtin.a")).toBeDefined();
            expect(registry.getSkill("custom.a")).toBeDefined();
        });
    });

    // ── Unregistration ──────────────────────────────────────

    describe("unregister()", () => {
        it("removes a registered skill", () => {
            registry.register(makeSkill());
            expect(registry.unregister("test.skill")).toBe(true);
            expect(registry.size).toBe(0);
            expect(registry.getSkill("test.skill")).toBeUndefined();
        });

        it("returns false for unknown skill ID", () => {
            expect(registry.unregister("nonexistent")).toBe(false);
        });
    });

    // ── Querying ────────────────────────────────────────────

    describe("getSkill()", () => {
        it("returns the skill for a valid ID", () => {
            const skill = makeSkill();
            registry.register(skill);
            expect(registry.getSkill("test.skill")).toBe(skill);
        });

        it("returns undefined for unknown ID", () => {
            expect(registry.getSkill("nonexistent")).toBeUndefined();
        });
    });

    describe("getAllSkills()", () => {
        it("returns empty array when registry is empty", () => {
            expect(registry.getAllSkills()).toEqual([]);
        });

        it("returns all registered skills", () => {
            registry.register(makeSkill({ id: "a" }));
            registry.register(makeSkill({ id: "b" }));
            expect(registry.getAllSkills()).toHaveLength(2);
        });
    });

    describe("getSkillsForAgent()", () => {
        it("returns only skills for the specified agent type", () => {
            registry.register(
                makeSkill({ id: "ideation.a", agentTypes: ["ideation"] })
            );
            registry.register(
                makeSkill({ id: "planning.a", agentTypes: ["planning"] })
            );
            registry.register(
                makeSkill({ id: "execution.a", agentTypes: ["execution"] })
            );

            const ideationSkills = registry.getSkillsForAgent("ideation");
            expect(ideationSkills).toHaveLength(1);
            expect(ideationSkills[0].id).toBe("ideation.a");
        });

        it("returns empty array for agent with no skills", () => {
            registry.register(
                makeSkill({ id: "ideation.a", agentTypes: ["ideation"] })
            );
            expect(registry.getSkillsForAgent("reviewer")).toHaveLength(0);
        });
    });

    // ── Shared Skills ───────────────────────────────────────

    describe("shared skills", () => {
        it("shared skills appear for multiple agent types", () => {
            registry.register(
                makeSkill({
                    id: "shared.web-search",
                    agentTypes: ["ideation", "execution"],
                })
            );

            expect(registry.getSkillsForAgent("ideation")).toHaveLength(1);
            expect(registry.getSkillsForAgent("execution")).toHaveLength(1);
            expect(registry.getSkillsForAgent("planning")).toHaveLength(0);
        });
    });

    // ── Relevance Scoring ───────────────────────────────────

    describe("getRelevantSkills()", () => {
        it("returns skills above relevance threshold", () => {
            registry.register(
                makeSkill({
                    id: "high",
                    agentTypes: ["ideation"],
                    relevanceScorer: () => 0.8,
                })
            );
            registry.register(
                makeSkill({
                    id: "low",
                    agentTypes: ["ideation"],
                    relevanceScorer: () => 0.1,
                })
            );

            const relevant = registry.getRelevantSkills(
                "ideation",
                "brainstorm"
            );
            expect(relevant).toHaveLength(1);
            expect(relevant[0].id).toBe("high");
        });

        it("uses default threshold of 0.3", () => {
            registry.register(
                makeSkill({
                    id: "above",
                    agentTypes: ["planning"],
                    relevanceScorer: () => 0.35,
                })
            );
            registry.register(
                makeSkill({
                    id: "below",
                    agentTypes: ["planning"],
                    relevanceScorer: () => 0.25,
                })
            );

            const relevant = registry.getRelevantSkills(
                "planning",
                "create a plan"
            );
            expect(relevant).toHaveLength(1);
            expect(relevant[0].id).toBe("above");
        });

        it("sorts results by relevance score (highest first)", () => {
            registry.register(
                makeSkill({
                    id: "medium",
                    agentTypes: ["ideation"],
                    relevanceScorer: () => 0.5,
                })
            );
            registry.register(
                makeSkill({
                    id: "high",
                    agentTypes: ["ideation"],
                    relevanceScorer: () => 0.9,
                })
            );
            registry.register(
                makeSkill({
                    id: "low-pass",
                    agentTypes: ["ideation"],
                    relevanceScorer: () => 0.35,
                })
            );

            const relevant = registry.getRelevantSkills(
                "ideation",
                "test"
            );
            expect(relevant[0].id).toBe("high");
            expect(relevant[1].id).toBe("medium");
            expect(relevant[2].id).toBe("low-pass");
        });

        it("accepts custom threshold", () => {
            registry.register(
                makeSkill({
                    id: "mid",
                    agentTypes: ["execution"],
                    relevanceScorer: () => 0.6,
                })
            );

            expect(
                registry.getRelevantSkills("execution", "test", 0.7)
            ).toHaveLength(0);
            expect(
                registry.getRelevantSkills("execution", "test", 0.5)
            ).toHaveLength(1);
        });
    });

    // ── Level 7 Inheritance Stub ────────────────────────────

    describe("getInheritedSkills()", () => {
        it("returns skills shared between parent and child agent types", () => {
            registry.register(
                makeSkill({
                    id: "shared.tool",
                    agentTypes: ["execution", "planning"],
                })
            );
            registry.register(
                makeSkill({
                    id: "exec-only",
                    agentTypes: ["execution"],
                })
            );

            // Child is "planning", parent is "execution"
            // Should return skills that parent has AND child can use
            const inherited = registry.getInheritedSkills(
                "planning",
                "execution"
            );
            expect(inherited).toHaveLength(1);
            expect(inherited[0].id).toBe("shared.tool");
        });
    });

    // ── Utility ─────────────────────────────────────────────

    describe("clear()", () => {
        it("removes all skills", () => {
            registry.register(makeSkill({ id: "a" }));
            registry.register(makeSkill({ id: "b" }));
            registry.clear();
            expect(registry.size).toBe(0);
            expect(registry.getAllSkills()).toEqual([]);
        });
    });
});
