/**
 * Level 5 — RAG Notification Tests
 *
 * Tests agent notification after RAG ingestion completes.
 */

import { describe, it, expect } from "vitest";
import { notifyAgent } from "baseclaw-agent/src/rag/notification.js";


describe("Level 5 — RAG Notification", () => {
    it("creates notification with correct fields", async () => {
        const result = await notifyAgent("planning", "report.pdf", 12);

        expect(result.agentName).toBe("planning");
        expect(result.filename).toBe("report.pdf");
        expect(result.chunkCount).toBe(12);
        expect(result.suggestedQuery).toContain("report.pdf");
        expect(result.timestamp).toBeTruthy();
    });

    it("generates a valid ISO timestamp", async () => {
        const result = await notifyAgent("ideation", "data.csv", 5);
        expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it("includes filename in suggested query", async () => {
        const result = await notifyAgent("execution", "my-code.ts", 3);
        expect(result.suggestedQuery).toContain("my-code.ts");
    });
});
