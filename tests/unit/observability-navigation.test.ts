import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTraceUrl } from "baseclaw-agent/src/observability/navigation.js";

describe("Bidirectional Navigation (Level 4)", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.LANGSMITH_ORG_ID;
        delete process.env.LANGCHAIN_PROJECT;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    // ── getTraceUrl ─────────────────────────────────────────

    it("returns a valid LangSmith URL with org ID", () => {
        process.env.LANGSMITH_ORG_ID = "test-org-123";
        process.env.LANGCHAIN_PROJECT = "base-agent-dev";

        const url = getTraceUrl("trace-abc-123");
        expect(url).toBe(
            "https://smith.langchain.com/o/test-org-123/projects/p/base-agent-dev/r/trace-abc-123"
        );
    });

    it("returns simplified URL without org ID", () => {
        delete process.env.LANGSMITH_ORG_ID;

        const url = getTraceUrl("trace-xyz-456");
        expect(url).toBe("https://smith.langchain.com/public/trace-xyz-456/r");
    });

    it("uses default project name when not set", () => {
        process.env.LANGSMITH_ORG_ID = "org-1";
        delete process.env.LANGCHAIN_PROJECT;

        const url = getTraceUrl("trace-id");
        expect(url).toContain("base-agent-dev");
    });

    it("throws when traceId is empty", () => {
        expect(() => getTraceUrl("")).toThrow("traceId is required");
    });

    // ── getEpisodesForTrace ─────────────────────────────────
    // Note: Full DB integration test would require a live DB.
    // Here we verify the function exists and has correct signature.

    it("getEpisodesForTrace is a callable function", async () => {
        const { getEpisodesForTrace } = await import(
            "baseclaw-agent/src/observability/navigation.js"
        );
        expect(typeof getEpisodesForTrace).toBe("function");
    });

    it("getEpisodesForTrace throws for empty traceId", async () => {
        const { getEpisodesForTrace } = await import(
            "baseclaw-agent/src/observability/navigation.js"
        );
        await expect(getEpisodesForTrace("")).rejects.toThrow("traceId is required");
    });

    // ── getTraceUrlForEpisode exists ────────────────────────

    it("getTraceUrlForEpisode is a callable function", async () => {
        const { getTraceUrlForEpisode } = await import(
            "baseclaw-agent/src/observability/navigation.js"
        );
        expect(typeof getTraceUrlForEpisode).toBe("function");
    });
});
