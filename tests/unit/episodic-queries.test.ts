/**
 * Episodic Memory Query Tests (Real PostgreSQL)
 *
 * Tests that query helper functions work against real PostgreSQL.
 * DATABASE_URL required — fails immediately if missing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
    insertEpisode,
    getRecentEpisodes,
    getEpisodesByAgent,
    getEpisodesByTask,
    searchEpisodes,
    getEpisodeById,
    insertDecision,
    insertHitlEvent,
    insertFileUpload,
    insertFeedbackLoop,
    insertSubAgentEvent,
    insertMcpUsage,
} from "baseclaw-agent/src/memory/episodic/queries.js";

describe("Episodic Memory Queries", { timeout: 15_000 }, () => {
    beforeAll(() => {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL is required. Set it in .env to run tests.");
        }
    });

    const TENANT_ID = "00000000-0000-0000-0000-000000000099";

    // ── Export Verification ─────────────────────────────────

    describe("exports", () => {
        it("exports insertEpisode as a function", () => {
            expect(typeof insertEpisode).toBe("function");
        });

        it("exports getRecentEpisodes as a function", () => {
            expect(typeof getRecentEpisodes).toBe("function");
        });

        it("exports getEpisodesByAgent as a function", () => {
            expect(typeof getEpisodesByAgent).toBe("function");
        });

        it("exports getEpisodesByTask as a function", () => {
            expect(typeof getEpisodesByTask).toBe("function");
        });

        it("exports searchEpisodes as a function", () => {
            expect(typeof searchEpisodes).toBe("function");
        });

        it("exports getEpisodeById as a function", () => {
            expect(typeof getEpisodeById).toBe("function");
        });

        it("exports all supporting table insert functions", () => {
            expect(typeof insertDecision).toBe("function");
            expect(typeof insertHitlEvent).toBe("function");
            expect(typeof insertFileUpload).toBe("function");
            expect(typeof insertFeedbackLoop).toBe("function");
            expect(typeof insertSubAgentEvent).toBe("function");
            expect(typeof insertMcpUsage).toBe("function");
        });
    });

    // ── Real DB Operations ─────────────────────────────────

    describe("insertEpisode + read-back", () => {
        it("inserts and returns a real episode record", async () => {
            const result = await insertEpisode(TENANT_ID, {
                agentType: "ideation",
                taskDescription: "Test task for episodic queries",
                outcome: "Success",
                durationMs: 1000,
                langsmithTraceId: "trace-eq-test-123",
            });

            expect(result).toBeDefined();
            expect(result.id).toBeTruthy();
            expect(result.tenantId).toBe(TENANT_ID);
            expect(result.agentType).toBe("ideation");
            expect(result.taskDescription).toBe("Test task for episodic queries");
            expect(result.langsmithTraceId).toBe("trace-eq-test-123");
        });

        it("getRecentEpisodes returns the inserted episode", async () => {
            const results = await getRecentEpisodes(TENANT_ID, 5);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            const found = results.find((e) => e.langsmithTraceId === "trace-eq-test-123");
            expect(found).toBeTruthy();
        });

        it("getRecentEpisodes accepts optional limit", async () => {
            const results = await getRecentEpisodes(TENANT_ID, 1);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(1);
        });

        it("getEpisodesByAgent filters correctly", async () => {
            const results = await getEpisodesByAgent(TENANT_ID, "ideation");
            expect(Array.isArray(results)).toBe(true);
            for (const ep of results) {
                expect(ep.agentType).toBe("ideation");
            }
        });

        it("getEpisodesByTask searches by task description", async () => {
            const results = await getEpisodesByTask(TENANT_ID, "episodic queries");
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
        });

        it("searchEpisodes searches across taskDescription and outcome", async () => {
            const results = await searchEpisodes(TENANT_ID, "Success");
            expect(Array.isArray(results)).toBe(true);
        });

        it("getEpisodeById returns null for non-existent ID", async () => {
            // Retry up to 3 times — under full parallel suite load,
            // DB connection pool can momentarily be exhausted
            let result: unknown = undefined;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    result = await getEpisodeById(TENANT_ID, "ffffffff-ffff-ffff-ffff-ffffffffffff");
                    lastError = null;
                    break;
                } catch (e) {
                    lastError = e instanceof Error ? e : new Error(String(e));
                    // Wait briefly before retry
                    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
                }
            }

            if (lastError) {
                throw lastError;
            }
            expect(result).toBeNull();
        });
    });

    // ── Trace ID storage ───────────────────────────────────

    describe("trace ID storage", () => {
        it("episode includes langsmithTraceId after insert", async () => {
            const result = await insertEpisode(TENANT_ID, {
                agentType: "execution",
                taskDescription: "Trace ID test",
                outcome: "Done",
                durationMs: 3000,
                langsmithTraceId: "trace-eq-789",
            });
            expect(result.langsmithTraceId).toBe("trace-eq-789");
        });
    });
});
