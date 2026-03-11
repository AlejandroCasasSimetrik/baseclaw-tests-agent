import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatSkillLoadTrace } from "baseclaw-agent/src/skills/skill-aware-agent.js";
import type { SkillLoadResult } from "baseclaw-agent/src/skills/types.js";

describe("Skill-Aware Agent", () => {
    // ── formatSkillLoadTrace() ─────────────────────────────

    describe("formatSkillLoadTrace()", () => {
        it("returns correct shape with empty results", () => {
            const trace = formatSkillLoadTrace([]);

            expect(trace.skillsConsidered).toBe(0);
            expect(trace.skillsLoaded).toBe(0);
            expect(trace.skillsSkipped).toBe(0);
            expect(trace.details).toEqual([]);
        });

        it("counts loaded vs skipped correctly", () => {
            const results: SkillLoadResult[] = [
                { skillId: "a", skillName: "Skill A", relevanceScore: 0.9, loaded: true, reason: "high score" },
                { skillId: "b", skillName: "Skill B", relevanceScore: 0.7, loaded: true, reason: "above threshold" },
                { skillId: "c", skillName: "Skill C", relevanceScore: 0.1, loaded: false, reason: "below threshold" },
            ];

            const trace = formatSkillLoadTrace(results);

            expect(trace.skillsConsidered).toBe(3);
            expect(trace.skillsLoaded).toBe(2);
            expect(trace.skillsSkipped).toBe(1);
        });

        it("includes detail entries for each result", () => {
            const results: SkillLoadResult[] = [
                { skillId: "x", skillName: "Skill X", relevanceScore: 0.8, loaded: true, reason: "relevant" },
                { skillId: "y", skillName: "Skill Y", relevanceScore: 0.2, loaded: false, reason: "irrelevant" },
            ];

            const trace = formatSkillLoadTrace(results);
            const details = trace.details as any[];

            expect(details).toHaveLength(2);
            expect(details[0]).toEqual({
                id: "x",
                name: "Skill X",
                score: 0.8,
                loaded: true,
                reason: "relevant",
            });
            expect(details[1]).toEqual({
                id: "y",
                name: "Skill Y",
                score: 0.2,
                loaded: false,
                reason: "irrelevant",
            });
        });

        it("handles all-loaded scenario", () => {
            const results: SkillLoadResult[] = [
                { skillId: "a", skillName: "A", relevanceScore: 1.0, loaded: true, reason: "yes" },
                { skillId: "b", skillName: "B", relevanceScore: 0.5, loaded: true, reason: "yes" },
            ];

            const trace = formatSkillLoadTrace(results);
            expect(trace.skillsLoaded).toBe(2);
            expect(trace.skillsSkipped).toBe(0);
        });

        it("handles all-skipped scenario", () => {
            const results: SkillLoadResult[] = [
                { skillId: "a", skillName: "A", relevanceScore: 0.1, loaded: false, reason: "no" },
                { skillId: "b", skillName: "B", relevanceScore: 0.0, loaded: false, reason: "no" },
            ];

            const trace = formatSkillLoadTrace(results);
            expect(trace.skillsLoaded).toBe(0);
            expect(trace.skillsSkipped).toBe(2);
        });
    });
});
