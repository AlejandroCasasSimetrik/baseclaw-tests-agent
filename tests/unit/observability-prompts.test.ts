import { describe, it, expect, beforeEach } from "vitest";
import {
    PromptRegistry,
    LOCAL_PROMPTS,
    getPromptRegistry,
    resetPromptRegistry,
} from "baseclaw-agent/src/observability/prompts.js";

describe("Prompt Management (Level 4)", () => {
    let registry: PromptRegistry;

    beforeEach(() => {
        resetPromptRegistry();
        registry = new PromptRegistry();
    });

    // ── LOCAL_PROMPTS ───────────────────────────────────────

    it("defines prompts for all 5 agents", () => {
        const promptNames = Object.keys(LOCAL_PROMPTS);
        expect(promptNames).toContain("baseclaw-conversation-system");
        expect(promptNames).toContain("baseclaw-conversation-response");
        expect(promptNames).toContain("baseclaw-ideation-system");
        expect(promptNames).toContain("baseclaw-planning-system");
        expect(promptNames).toContain("baseclaw-execution-system");
        expect(promptNames).toContain("baseclaw-reviewer-system");
    });

    it("all prompts are non-empty strings", () => {
        for (const [name, template] of Object.entries(LOCAL_PROMPTS)) {
            expect(typeof template).toBe("string");
            expect(template.length).toBeGreaterThan(50);
        }
    });

    it("conversation prompt mentions routing to specialists", () => {
        const prompt = LOCAL_PROMPTS["baseclaw-conversation-system"];
        expect(prompt).toContain("Ideation Agent");
        expect(prompt).toContain("Planning Agent");
        expect(prompt).toContain("Execution Agent");
        expect(prompt).toContain("Reviewer Agent");
    });

    // ── PromptRegistry.loadPrompt ───────────────────────────

    it("loads prompt from local defaults (no LangSmith)", async () => {
        const prompt = await registry.loadPrompt("baseclaw-conversation-system");
        expect(prompt).toBe(LOCAL_PROMPTS["baseclaw-conversation-system"]);
    });

    it("throws for unknown prompt name", async () => {
        await expect(
            registry.loadPrompt("nonexistent-prompt")
        ).rejects.toThrow("Prompt not found");
    });

    it("caches prompts after first load", async () => {
        const prompt1 = await registry.loadPrompt("baseclaw-ideation-system");
        const prompt2 = await registry.loadPrompt("baseclaw-ideation-system");
        expect(prompt1).toBe(prompt2);
    });

    // ── PromptRegistry.clearCache ───────────────────────────

    it("clears the prompt cache", async () => {
        await registry.loadPrompt("baseclaw-conversation-system");
        registry.clearCache();
        // Should re-load from local defaults
        const prompt = await registry.loadPrompt("baseclaw-conversation-system");
        expect(prompt).toBe(LOCAL_PROMPTS["baseclaw-conversation-system"]);
    });

    // ── PromptRegistry.getAvailablePrompts ──────────────────

    it("returns all available prompt names", () => {
        const names = registry.getAvailablePrompts();
        expect(names.length).toBeGreaterThanOrEqual(6);
    });

    // ── PromptRegistry.initialize ───────────────────────────

    it("pre-populates cache with local defaults", async () => {
        await registry.initialize();
        for (const name of Object.keys(LOCAL_PROMPTS)) {
            const prompt = await registry.loadPrompt(name);
            expect(prompt).toBe(LOCAL_PROMPTS[name]);
        }
    });

    // ── Singleton ───────────────────────────────────────────

    it("getPromptRegistry returns singleton", () => {
        const r1 = getPromptRegistry();
        const r2 = getPromptRegistry();
        expect(r1).toBe(r2);
    });

    it("resetPromptRegistry creates a new instance", () => {
        const r1 = getPromptRegistry();
        resetPromptRegistry();
        const r2 = getPromptRegistry();
        expect(r1).not.toBe(r2);
    });
});
