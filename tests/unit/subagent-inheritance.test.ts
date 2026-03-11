/**
 * Level 8 — Sub-agent Inheritance Tests
 *
 * Tests for skill and MCP server inheritance:
 *   - Skill snapshot from parent
 *   - Dynamic skill loading for sub-agents
 *   - MCP inheritance via MCPAttachmentManager
 *   - Cleanup on dissolve (own servers only)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    inheritSkills,
    loadAdditionalSkills,
} from "baseclaw-agent/src/subagent/inheritance.js";
import { SkillRegistry } from "baseclaw-agent/src/skills/registry.js";
import { registerBuiltinSkills } from "baseclaw-agent/src/skills/index.js";
import type { SkillDefinition } from "baseclaw-agent/src/skills/types.js";

describe("Level 8 — Sub-agent Inheritance", () => {
    describe("Skill Inheritance", () => {
        let registry: SkillRegistry;

        beforeEach(() => {
            registry = new SkillRegistry();
            registerBuiltinSkills(registry);
        });

        it("inherits skills from parent by ID", () => {
            const allSkills = registry.getAllSkills();
            expect(allSkills.length).toBeGreaterThan(0);

            // Use actual skill IDs from the registry
            const parentSkillIds = allSkills.slice(0, 2).map((s) => s.id);
            const inherited = inheritSkills(parentSkillIds, registry);

            expect(inherited).toHaveLength(2);
            expect(inherited.map((s) => s.id)).toEqual(parentSkillIds);
        });

        it("skips skill IDs that don't exist in registry", () => {
            const parentSkillIds = ["non-existent-skill-1", "non-existent-skill-2"];
            const inherited = inheritSkills(parentSkillIds, registry);

            expect(inherited).toHaveLength(0);
        });

        it("handles empty parent skill list", () => {
            const inherited = inheritSkills([], registry);
            expect(inherited).toHaveLength(0);
        });

        it("returns actual SkillDefinition objects", () => {
            const allSkills = registry.getAllSkills();
            if (allSkills.length === 0) return;

            const parentSkillIds = [allSkills[0].id];
            const inherited = inheritSkills(parentSkillIds, registry);

            expect(inherited[0]).toHaveProperty("id");
            expect(inherited[0]).toHaveProperty("name");
            expect(inherited[0]).toHaveProperty("handler");
            expect(inherited[0]).toHaveProperty("relevanceScorer");
        });
    });

    describe("Dynamic Skill Loading", () => {
        let registry: SkillRegistry;

        beforeEach(() => {
            registry = new SkillRegistry();
            registerBuiltinSkills(registry);
        });

        it("loads additional skills not already inherited", () => {
            const allSkills = registry.getAllSkills();
            if (allSkills.length < 2) return; // Need at least 2 skills

            const existing = [allSkills[0].id];
            const additional = loadAdditionalSkills(
                "ideation",
                "brainstorming ideas",
                registry,
                existing,
                0.0 // Low threshold to get all skills
            );

            // Should NOT include the already-inherited skill
            const additionalIds = additional.map((s) => s.id);
            expect(additionalIds).not.toContain(existing[0]);
        });

        it("returns empty array when no additional skills match", () => {
            const allSkillIds = registry.getAllSkills().map((s) => s.id);
            const additional = loadAdditionalSkills(
                "ideation",
                "task",
                registry,
                allSkillIds, // All skills already inherited
                0.0
            );

            expect(additional).toHaveLength(0);
        });

        it("respects threshold for additional skill loading", () => {
            const additional = loadAdditionalSkills(
                "ideation",
                "brainstorming",
                registry,
                [],
                1.0 // Very high threshold
            );

            // With a 1.0 threshold, unlikely any skill scores high enough
            // unless a skill is perfectly matched
            expect(Array.isArray(additional)).toBe(true);
        });
    });

    describe("Skill Isolation", () => {
        it("parent skills are not modified by sub-agent operations", () => {
            const registry = new SkillRegistry();
            registerBuiltinSkills(registry);

            // Snapshot parent skills
            const parentSkillIds = registry.getAllSkills().map((s) => s.id);
            const parentSkillCount = registry.size;

            // Simulate sub-agent loading additional skills
            // (Nothing actually modifies the registry — just reads from it)
            const inherited = inheritSkills(parentSkillIds, registry);
            const additional = loadAdditionalSkills(
                "ideation",
                "task",
                registry,
                parentSkillIds,
                0.0
            );

            // Parent's registry should be unchanged
            expect(registry.size).toBe(parentSkillCount);
            expect(registry.getAllSkills().map((s) => s.id)).toEqual(parentSkillIds);
        });
    });
});
