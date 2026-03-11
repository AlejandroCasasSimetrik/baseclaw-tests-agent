import { describe, it, expect, beforeEach } from "vitest";
import { SkillLoader } from "baseclaw-agent/src/skills/loader.js";
import { SkillRegistry } from "baseclaw-agent/src/skills/registry.js";
import type { SkillDefinition, AgentType } from "baseclaw-agent/src/skills/types.js";

/** Helper to create a test skill with configurable relevance */
function makeSkill(
    id: string,
    agentTypes: AgentType[],
    relevance: number,
    prompt: string = "Fragment"
): SkillDefinition {
    return {
        id,
        name: id.replace(/\./g, " "),
        description: `Test skill ${id}`,
        agentTypes,
        handler: async () => ({ output: `output from ${id}` }),
        relevanceScorer: () => relevance,
        systemPromptFragment: prompt,
    };
}

describe("SkillLoader", () => {
    let loader: SkillLoader;
    let registry: SkillRegistry;

    beforeEach(() => {
        loader = new SkillLoader();
        registry = new SkillRegistry();
    });

    // ── loadSkillsForTask ───────────────────────────────────

    describe("loadSkillsForTask()", () => {
        it("returns only relevant skills above threshold", async () => {
            registry.register(makeSkill("high", ["ideation"], 0.8));
            registry.register(makeSkill("low", ["ideation"], 0.1));
            registry.register(makeSkill("medium", ["ideation"], 0.5));

            const { loadedSkills, loadResults } =
                await loader.loadSkillsForTask(
                    "ideation",
                    "brainstorm ideas",
                    registry
                );

            expect(loadedSkills).toHaveLength(2); // high + medium
            expect(loadedSkills.map((s) => s.id)).toContain("high");
            expect(loadedSkills.map((s) => s.id)).toContain("medium");
            expect(loadResults).toHaveLength(3); // all 3 were considered
        });

        it("skips skills below threshold", async () => {
            registry.register(makeSkill("low", ["execution"], 0.1));

            const { loadedSkills, loadResults } =
                await loader.loadSkillsForTask(
                    "execution",
                    "build something",
                    registry
                );

            expect(loadedSkills).toHaveLength(0);
            expect(loadResults[0].loaded).toBe(false);
            expect(loadResults[0].reason).toContain("< threshold");
        });

        it("generates load results for all evaluated skills", async () => {
            registry.register(makeSkill("a", ["planning"], 0.9));
            registry.register(makeSkill("b", ["planning"], 0.2));

            const { loadResults } = await loader.loadSkillsForTask(
                "planning",
                "plan the project",
                registry
            );

            expect(loadResults).toHaveLength(2);

            const loaded = loadResults.find((r) => r.skillId === "a");
            const skipped = loadResults.find((r) => r.skillId === "b");

            expect(loaded?.loaded).toBe(true);
            expect(loaded?.reason).toContain(">= threshold");
            expect(skipped?.loaded).toBe(false);
            expect(skipped?.reason).toContain("< threshold");
        });

        it("returns empty results when no skills match agent type", async () => {
            registry.register(makeSkill("exec-only", ["execution"], 1.0));

            const { loadedSkills } = await loader.loadSkillsForTask(
                "ideation",
                "brainstorm",
                registry
            );

            expect(loadedSkills).toHaveLength(0);
        });

        it("respects custom threshold", async () => {
            registry.register(makeSkill("mid", ["reviewer"], 0.5));

            const high = await loader.loadSkillsForTask(
                "reviewer",
                "review",
                registry,
                0.8
            );
            expect(high.loadedSkills).toHaveLength(0);

            const low = await loader.loadSkillsForTask(
                "reviewer",
                "review",
                registry,
                0.3
            );
            expect(low.loadedSkills).toHaveLength(1);
        });
    });

    // ── unloadSkills ────────────────────────────────────────

    describe("unloadSkills()", () => {
        it("returns the IDs that were unloaded", () => {
            const ids = ["skill.a", "skill.b", "skill.c"];
            const unloaded = loader.unloadSkills(ids);
            expect(unloaded).toEqual(ids);
        });

        it("handles empty array", () => {
            expect(loader.unloadSkills([])).toEqual([]);
        });

        it("does not mutate the input array", () => {
            const ids = ["skill.a"];
            const unloaded = loader.unloadSkills(ids);
            unloaded.push("extra");
            expect(ids).toHaveLength(1);
        });

        it("accepts agentType parameter", () => {
            const ids = ["skill.a"];
            const unloaded = loader.unloadSkills(ids, "ideation");
            expect(unloaded).toEqual(ids);
        });

        it("accepts registry parameter and resolves skill names", () => {
            registry.register(makeSkill("skill.x", ["conversation"], 1.0));
            const unloaded = loader.unloadSkills(["skill.x"], "conversation", registry);
            expect(unloaded).toEqual(["skill.x"]);
        });

        it("works with all agent types", () => {
            const agentTypes: AgentType[] = ["conversation", "ideation", "planning", "execution", "reviewer"];
            for (const at of agentTypes) {
                const unloaded = loader.unloadSkills(["a"], at);
                expect(unloaded).toEqual(["a"]);
            }
        });

        it("handles skill IDs not in registry gracefully", () => {
            // Skill not registered — should still unload without throwing
            const unloaded = loader.unloadSkills(["nonexistent"], "conversation", registry);
            expect(unloaded).toEqual(["nonexistent"]);
        });
    });

    // ── buildSkillPrompt ────────────────────────────────────

    describe("buildSkillPrompt()", () => {
        it("returns empty string for no skills", () => {
            expect(loader.buildSkillPrompt([])).toBe("");
        });

        it("concatenates skill prompt fragments", () => {
            const skills = [
                makeSkill("a", ["ideation"], 1, "Fragment A"),
                makeSkill("b", ["ideation"], 1, "Fragment B"),
            ];

            const prompt = loader.buildSkillPrompt(skills);

            expect(prompt).toContain("# Active Skills");
            expect(prompt).toContain("Fragment A");
            expect(prompt).toContain("Fragment B");
            expect(prompt).toContain("## Skill: a");
            expect(prompt).toContain("## Skill: b");
        });

        it("includes the Active Skills header", () => {
            const skills = [makeSkill("x", ["ideation"], 1, "Test")];
            const prompt = loader.buildSkillPrompt(skills);
            expect(prompt).toContain("# Active Skills");
        });
    });
});
