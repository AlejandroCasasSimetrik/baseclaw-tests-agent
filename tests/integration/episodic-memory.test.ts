import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, resetDb } from "baseclaw-agent/src/memory/episodic/db.js";
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

/**
 * Episodic Memory — Live Integration Tests
 *
 * Runs against the local PostgreSQL database.
 * Requires: DATABASE_URL env var pointing to a running Postgres instance
 *           with the migration already applied.
 *
 * These tests CREATE real rows in the database, scoped to a unique
 * tenant ID so they don't conflict with other data.
 */

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000001";

describe("Episodic Memory (live PostgreSQL)", () => {
    let createdEpisodeId: string;

    beforeAll(() => {
        // Verify DATABASE_URL is set
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL required for integration tests");
        }
    });

    afterAll(() => {
        resetDb();
    });

    // ── Connection ─────────────────────────────────────────

    describe("database connection", () => {
        it("connects to PostgreSQL successfully", () => {
            const db = getDb();
            expect(db).toBeDefined();
        });
    });

    // ── Insert Episode ─────────────────────────────────────

    describe("insertEpisode()", () => {
        it("inserts an episode and returns the record with id", async () => {
            const result = await insertEpisode(TEST_TENANT_ID, {
                agentType: "ideation",
                taskDescription: "Integration test — ideation task",
                outcome: "Generated 3 creative concepts",
                durationMs: 2500,
                langsmithTraceId: "trace-integ-001",
                metadata: { testRun: true, timestamp: new Date().toISOString() },
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.tenantId).toBe(TEST_TENANT_ID);
            expect(result.agentType).toBe("ideation");
            expect(result.taskDescription).toBe("Integration test — ideation task");
            expect(result.outcome).toBe("Generated 3 creative concepts");
            expect(result.durationMs).toBe(2500);
            expect(result.langsmithTraceId).toBe("trace-integ-001");
            expect(result.createdAt).toBeInstanceOf(Date);

            createdEpisodeId = result.id;
        });

        it("inserts a second episode for query testing", async () => {
            const result = await insertEpisode(TEST_TENANT_ID, {
                agentType: "execution",
                taskDescription: "Integration test — execution task",
                outcome: "Code written and committed",
                durationMs: 8000,
                langsmithTraceId: "trace-integ-002",
            });

            expect(result.id).toBeDefined();
            expect(result.agentType).toBe("execution");
        });

        it("inserts a third episode with different agent", async () => {
            const result = await insertEpisode(TEST_TENANT_ID, {
                agentType: "reviewer",
                taskDescription: "Integration test — review task",
                outcome: "Quality score: 9/10",
                durationMs: 3000,
                langsmithTraceId: "trace-integ-003",
            });

            expect(result.agentType).toBe("reviewer");
        });
    });

    // ── Query Episodes ─────────────────────────────────────

    describe("getRecentEpisodes()", () => {
        it("returns episodes for the test tenant", async () => {
            const episodes = await getRecentEpisodes(TEST_TENANT_ID, 10);

            expect(Array.isArray(episodes)).toBe(true);
            expect(episodes.length).toBeGreaterThanOrEqual(3);
        });

        it("respects the limit parameter", async () => {
            const episodes = await getRecentEpisodes(TEST_TENANT_ID, 2);

            expect(episodes.length).toBeLessThanOrEqual(2);
        });

        it("returns episodes ordered by createdAt descending", async () => {
            const episodes = await getRecentEpisodes(TEST_TENANT_ID, 10);

            for (let i = 1; i < episodes.length; i++) {
                const prev = new Date(episodes[i - 1].createdAt).getTime();
                const curr = new Date(episodes[i].createdAt).getTime();
                expect(prev).toBeGreaterThanOrEqual(curr);
            }
        });
    });

    describe("getEpisodesByAgent()", () => {
        it("returns only episodes for the specified agent type", async () => {
            const episodes = await getEpisodesByAgent(TEST_TENANT_ID, "ideation");

            expect(episodes.length).toBeGreaterThanOrEqual(1);
            for (const ep of episodes) {
                expect(ep.agentType).toBe("ideation");
            }
        });

        it("returns empty array for agent with no episodes", async () => {
            const episodes = await getEpisodesByAgent(TEST_TENANT_ID, "nonexistent-agent");

            expect(Array.isArray(episodes)).toBe(true);
            expect(episodes.length).toBe(0);
        });
    });

    describe("getEpisodesByTask()", () => {
        it("returns episodes matching the task description", async () => {
            const episodes = await getEpisodesByTask(TEST_TENANT_ID, "Integration test");

            expect(episodes.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("searchEpisodes()", () => {
        it("finds episodes by partial text match", async () => {
            const episodes = await searchEpisodes(TEST_TENANT_ID, "creative concepts");

            expect(episodes.length).toBeGreaterThanOrEqual(1);
        });

        it("returns empty for non-matching search", async () => {
            const episodes = await searchEpisodes(
                TEST_TENANT_ID,
                "xyzzy-no-match-98765"
            );

            expect(episodes.length).toBe(0);
        });
    });

    describe("getEpisodeById()", () => {
        it("retrieves a specific episode by ID", async () => {
            const episode = await getEpisodeById(TEST_TENANT_ID, createdEpisodeId);

            expect(episode).toBeDefined();
            expect(episode!.id).toBe(createdEpisodeId);
            expect(episode!.tenantId).toBe(TEST_TENANT_ID);
        });

        it("returns null for non-existent ID", async () => {
            const episode = await getEpisodeById(
                TEST_TENANT_ID,
                "00000000-0000-0000-0000-000000000000"
            );

            expect(episode).toBeNull();
        });
    });

    // ── Child Table Inserts ────────────────────────────────

    describe("child table inserts (linked to episode)", () => {
        it("inserts a decision linked to the episode", async () => {
            const result = await insertDecision(TEST_TENANT_ID, {
                agentType: "ideation",
                reasoning: "Selected concept B because it aligns with user goals",
                contextSnapshot: { userGoal: "Build a feature", options: ["A", "B", "C"] },
                episodeId: createdEpisodeId,
                langsmithTraceId: "trace-integ-decision-001",
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.episodeId).toBe(createdEpisodeId);
        });

        it("inserts a HITL event linked to the episode", async () => {
            const result = await insertHitlEvent(TEST_TENANT_ID, {
                reason: "Quality score below threshold",
                agentType: "reviewer",
                episodeId: createdEpisodeId,
                langsmithTraceId: "trace-integ-hitl-001",
            });

            expect(result).toBeDefined();
            expect(result.reason).toBe("Quality score below threshold");
        });

        it("inserts a file upload linked to the episode", async () => {
            const result = await insertFileUpload(TEST_TENANT_ID, {
                filename: "test-document.pdf",
                fileType: "application/pdf",
                sizeBytes: 1024000,
                parseStatus: "completed",
                chunkCount: 15,
                episodeId: createdEpisodeId,
                langsmithTraceId: "trace-integ-file-001",
            });

            expect(result).toBeDefined();
            expect(result.filename).toBe("test-document.pdf");
        });

        it("inserts a feedback loop linked to the episode", async () => {
            const result = await insertFeedbackLoop(TEST_TENANT_ID, {
                sourceAgent: "reviewer",
                targetAgent: "execution",
                feedbackContent: "Refactor the error handling in the API layer",
                revisionCount: 2,
                episodeId: createdEpisodeId,
                langsmithTraceId: "trace-integ-feedback-001",
            });

            expect(result).toBeDefined();
            expect(result.sourceAgent).toBe("reviewer");
            expect(result.targetAgent).toBe("execution");
        });

        it("inserts a sub-agent event linked to the episode", async () => {
            const result = await insertSubAgentEvent(TEST_TENANT_ID, {
                parentAgent: "planning",
                subAgentType: "research",
                task: "Find relevant documentation",
                result: "Found 5 relevant documents",
                eventType: "spawn",
                episodeId: createdEpisodeId,
                langsmithTraceId: "trace-integ-subagent-001",
            });

            expect(result).toBeDefined();
            expect(result.parentAgent).toBe("planning");
        });

        it("inserts an MCP usage record linked to the episode", async () => {
            const result = await insertMcpUsage(TEST_TENANT_ID, {
                serverName: "github",
                toolName: "search_repos",
                inputSummary: "query: baseclaw agent",
                outputSummary: "Found 3 repositories",
                latencyMs: 450,
                episodeId: createdEpisodeId,
                langsmithTraceId: "trace-integ-mcp-001",
            });

            expect(result).toBeDefined();
            expect(result.serverName).toBe("github");
            expect(result.toolName).toBe("search_repos");
            expect(result.latencyMs).toBe(450);
        });
    });

    // ── Multi-tenancy isolation ────────────────────────────

    describe("multi-tenancy isolation", () => {
        it("episodes from a different tenant are not returned", async () => {
            const differentTenant = "00000000-0000-0000-0000-999999999999";

            // Insert an episode for a different tenant
            await insertEpisode(differentTenant, {
                agentType: "ideation",
                taskDescription: "Different tenant task",
                outcome: "Should not appear in test tenant queries",
                durationMs: 100,
                langsmithTraceId: "trace-other-tenant",
            });

            // Query for our test tenant — should not include the other tenant's data
            const episodes = await getRecentEpisodes(TEST_TENANT_ID, 100);
            const hasOtherTenant = episodes.some(
                (ep) => ep.tenantId === differentTenant
            );

            expect(hasOtherTenant).toBe(false);
        });
    });
});
