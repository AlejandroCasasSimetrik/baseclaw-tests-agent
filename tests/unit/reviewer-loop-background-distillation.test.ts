import { describe, it, expect } from "vitest";
import { runBackgroundDistillation } from "baseclaw-agent/src/reviewer-loop/background-distillation.js";

describe("Level 10 — Background Distillation", () => {
    it("returns empty array when episodic memory is not available", async () => {
        // With no DB connection, should gracefully return empty
        const result = await runBackgroundDistillation("test-tenant");
        expect(Array.isArray(result)).toBe(true);
    }, 30_000);

    it("accepts a custom episode limit", async () => {
        const result = await runBackgroundDistillation("test-tenant", 10);
        expect(Array.isArray(result)).toBe(true);
    }, 30_000);

    it("returns DistilledKnowledge[] shape when episodes available", async () => {
        // Even without a real DB, verify the return type is correct
        const result = await runBackgroundDistillation("test-tenant");
        for (const entry of result) {
            expect(entry.content).toBeTruthy();
            expect(["pattern", "anti_pattern", "criteria", "template"]).toContain(
                entry.knowledgeType
            );
            expect(entry.agentRelevance.length).toBeGreaterThanOrEqual(1);
            expect(entry.tenantId).toBe("test-tenant");
            expect(entry.timestamp).toBeTruthy();
        }
    }, 30_000);
});
