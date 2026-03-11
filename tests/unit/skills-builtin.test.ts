import { describe, it, expect, beforeEach } from "vitest";
import { SkillRegistry } from "baseclaw-agent/src/skills/registry.js";
import { registerBuiltinSkills } from "baseclaw-agent/src/skills/builtin/index.js";
import { ideationSkills } from "baseclaw-agent/src/skills/builtin/ideation.js";
import { planningSkills } from "baseclaw-agent/src/skills/builtin/planning.js";
import { executionSkills } from "baseclaw-agent/src/skills/builtin/execution.js";
import { reviewerSkills } from "baseclaw-agent/src/skills/builtin/reviewer.js";
import { sharedSkills } from "baseclaw-agent/src/skills/builtin/shared.js";
import { conversationSkills } from "baseclaw-agent/src/skills/builtin/conversation.js";
import type { SkillDefinition, AgentType } from "baseclaw-agent/src/skills/types.js";

// ── Dynamic expected counts (derived from source arrays) ──────
// These ensure tests stay green when skills are added/removed.
const allBuiltinSkills: SkillDefinition[] = [
    ...ideationSkills,
    ...planningSkills,
    ...executionSkills,
    ...reviewerSkills,
    ...sharedSkills,
    ...conversationSkills,
];

function expectedSkillCountForAgent(agentType: AgentType): number {
    return allBuiltinSkills.filter((s) => s.agentTypes.includes(agentType)).length;
}

describe("Built-in Skills", () => {
    let registry: SkillRegistry;

    beforeEach(() => {
        registry = new SkillRegistry();
        registerBuiltinSkills(registry);
    });

    // ── Skill Counts ────────────────────────────────────────

    describe("skill counts per agent type", () => {
        it("ideation skills array is non-empty", () => {
            expect(ideationSkills.length).toBeGreaterThan(0);
        });

        it("planning skills array is non-empty", () => {
            expect(planningSkills.length).toBeGreaterThan(0);
        });

        it("execution skills array is non-empty", () => {
            expect(executionSkills.length).toBeGreaterThan(0);
        });

        it("reviewer skills array is non-empty", () => {
            expect(reviewerSkills.length).toBeGreaterThan(0);
        });

        it("shared skills array has at least 1 skill", () => {
            expect(sharedSkills.length).toBeGreaterThanOrEqual(1);
        });

        it("total registered skills matches sum of all builtin arrays", () => {
            expect(registry.size).toBe(allBuiltinSkills.length);
        });
    });

    // ── Skill Interface Validation ──────────────────────────

    describe("skill interface compliance", () => {
        const allSkills: SkillDefinition[] = [
            ...ideationSkills,
            ...planningSkills,
            ...executionSkills,
            ...reviewerSkills,
            ...sharedSkills,
        ];

        it("all skills have required string fields", () => {
            for (const skill of allSkills) {
                expect(skill.id, `${skill.id} missing id`).toBeTruthy();
                expect(typeof skill.id).toBe("string");

                expect(skill.name, `${skill.id} missing name`).toBeTruthy();
                expect(typeof skill.name).toBe("string");

                expect(
                    skill.description,
                    `${skill.id} missing description`
                ).toBeTruthy();
                expect(typeof skill.description).toBe("string");

                expect(
                    skill.systemPromptFragment,
                    `${skill.id} missing systemPromptFragment`
                ).toBeTruthy();
                expect(typeof skill.systemPromptFragment).toBe("string");
                expect(skill.systemPromptFragment.length).toBeGreaterThan(50);
            }
        });

        it("all skills have valid agentTypes arrays", () => {
            const validTypes = [
                "conversation",
                "ideation",
                "planning",
                "execution",
                "reviewer",
            ];
            for (const skill of allSkills) {
                expect(Array.isArray(skill.agentTypes)).toBe(true);
                expect(skill.agentTypes.length).toBeGreaterThan(0);
                for (const t of skill.agentTypes) {
                    expect(validTypes).toContain(t);
                }
            }
        });

        it("all skills have handler functions", () => {
            for (const skill of allSkills) {
                expect(typeof skill.handler).toBe("function");
            }
        });

        it("all skills have relevanceScorer functions", () => {
            for (const skill of allSkills) {
                expect(typeof skill.relevanceScorer).toBe("function");
            }
        });

        it("all skill IDs are unique", () => {
            const ids = allSkills.map((s) => s.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    // ── Relevance Scorers ───────────────────────────────────

    describe("relevance scorers", () => {
        const allSkills: SkillDefinition[] = [
            ...ideationSkills,
            ...planningSkills,
            ...executionSkills,
            ...reviewerSkills,
            ...sharedSkills,
        ];

        it("all scorers return numbers between 0 and 1", () => {
            for (const skill of allSkills) {
                const score = skill.relevanceScorer(
                    skill.agentTypes[0],
                    "test task context"
                );
                expect(score).toBeGreaterThanOrEqual(0);
                expect(score).toBeLessThanOrEqual(1);
            }
        });

        it("scorers return low value for empty context", () => {
            for (const skill of allSkills) {
                const score = skill.relevanceScorer(
                    skill.agentTypes[0],
                    ""
                );
                expect(score).toBeLessThan(0.5);
            }
        });

        it("ideation question-generation scores high for 'explore questions'", () => {
            const qg = ideationSkills.find(
                (s) => s.id === "ideation.question-generation"
            )!;
            const score = qg.relevanceScorer(
                "ideation",
                "explore questions and understand why"
            );
            expect(score).toBeGreaterThan(0.3);
        });

        it("planning task-decomposition scores high for 'break down tasks'", () => {
            const td = planningSkills.find(
                (s) => s.id === "planning.task-decomposition"
            )!;
            const score = td.relevanceScorer(
                "planning",
                "decompose and break down the task into steps"
            );
            expect(score).toBeGreaterThan(0.3);
        });

        it("execution code-generation scores high for 'implement code'", () => {
            const cg = executionSkills.find(
                (s) => s.id === "execution.code-generation"
            )!;
            const score = cg.relevanceScorer(
                "execution",
                "implement the code and write a function"
            );
            expect(score).toBeGreaterThan(0.3);
        });

        it("reviewer quality-scoring scores high for 'evaluate quality'", () => {
            const qs = reviewerSkills.find(
                (s) => s.id === "reviewer.quality-scoring"
            )!;
            const score = qs.relevanceScorer(
                "reviewer",
                "evaluate the quality and score the output"
            );
            expect(score).toBeGreaterThan(0.3);
        });
    });

    // ── Skill Handlers ──────────────────────────────────────

    describe("skill handlers", () => {
        it("all handlers return valid SkillResult objects", async () => {
            const allSkills: SkillDefinition[] = [
                ...ideationSkills,
                ...planningSkills,
                ...executionSkills,
                ...reviewerSkills,
                ...sharedSkills,
            ];

            for (const skill of allSkills) {
                const result = await skill.handler({
                    taskContext: "test context",
                    agentType: skill.agentTypes[0],
                    messages: [],
                });

                expect(result).toBeDefined();
                expect(typeof result.output).toBe("string");
                expect(result.output.length).toBeGreaterThan(0);
            }
        });
    });

    // ── Shared Skills ───────────────────────────────────────

    describe("shared skills", () => {
        it("web search is available to ideation and execution", () => {
            const ws = sharedSkills.find((s) => s.id === "shared.web-search")!;
            expect(ws.agentTypes).toContain("ideation");
            expect(ws.agentTypes).toContain("execution");
        });

        it("web search appears when querying for ideation agent", () => {
            const ideation = registry.getSkillsForAgent("ideation");
            const hasWebSearch = ideation.some(
                (s) => s.id === "shared.web-search"
            );
            expect(hasWebSearch).toBe(true);
        });

        it("web search appears when querying for execution agent", () => {
            const execution = registry.getSkillsForAgent("execution");
            const hasWebSearch = execution.some(
                (s) => s.id === "shared.web-search"
            );
            expect(hasWebSearch).toBe(true);
        });

        it("web search does NOT appear for planning agent", () => {
            const planning = registry.getSkillsForAgent("planning");
            const hasWebSearch = planning.some(
                (s) => s.id === "shared.web-search"
            );
            expect(hasWebSearch).toBe(false);
        });
    });

    // ── Registry Integration ────────────────────────────────

    describe("registry integration", () => {
        it("ideation agent gets correct skill count from registry", () => {
            const skills = registry.getSkillsForAgent("ideation");
            expect(skills).toHaveLength(expectedSkillCountForAgent("ideation"));
        });

        it("planning agent gets correct skill count from registry", () => {
            const skills = registry.getSkillsForAgent("planning");
            expect(skills).toHaveLength(expectedSkillCountForAgent("planning"));
        });

        it("execution agent gets correct skill count from registry", () => {
            const skills = registry.getSkillsForAgent("execution");
            expect(skills).toHaveLength(expectedSkillCountForAgent("execution"));
        });

        it("reviewer agent gets correct skill count from registry", () => {
            const skills = registry.getSkillsForAgent("reviewer");
            expect(skills).toHaveLength(expectedSkillCountForAgent("reviewer"));
        });
    });
});
