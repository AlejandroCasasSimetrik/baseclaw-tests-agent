import { describe, it, expect } from "vitest";
import {
    episodes,
    decisions,
    hitlEvents,
    fileUploads,
    feedbackLoops,
    subAgentEvents,
    mcpUsage,
    continuousTasks,
    heartbeatLock,
    allTables,
    COMMON_COLUMNS,
} from "baseclaw-agent/src/memory/episodic/schema.js";

/**
 * Episodic Memory Schema Tests
 *
 * Validates the Drizzle ORM table definitions without needing a DB connection.
 * Tests structural correctness: columns, common fields, table count.
 */

// Helper to get column names from a Drizzle table
function getColumnNames(table: any): string[] {
    const columns = Object.keys(table);
    // Drizzle table objects expose column definitions as properties
    // Filter to actual column objects (they have a .name property)
    return columns.filter(
        (key) => table[key] && typeof table[key] === "object" && "name" in table[key]
    );
}

describe("Episodic Memory Schema", () => {
    // ── Table Count ────────────────────────────────────────

    describe("schema completeness", () => {
        it("has exactly 12 tables", () => {
            expect(Object.keys(allTables)).toHaveLength(12);
        });

        it("exports all expected tables", () => {
            const tableNames = Object.keys(allTables);
            expect(tableNames).toContain("episodes");
            expect(tableNames).toContain("decisions");
            expect(tableNames).toContain("hitlEvents");
            expect(tableNames).toContain("fileUploads");
            expect(tableNames).toContain("feedbackLoops");
            expect(tableNames).toContain("subAgentEvents");
            expect(tableNames).toContain("mcpUsage");
            // Level 9
            expect(tableNames).toContain("continuousTasks");
            expect(tableNames).toContain("heartbeatLock");
        });
    });

    // ── Common Columns ─────────────────────────────────────

    describe("common columns on every table", () => {
        const tables = [
            { name: "episodes", table: episodes },
            { name: "decisions", table: decisions },
            { name: "hitlEvents", table: hitlEvents },
            { name: "fileUploads", table: fileUploads },
            { name: "feedbackLoops", table: feedbackLoops },
            { name: "subAgentEvents", table: subAgentEvents },
            { name: "mcpUsage", table: mcpUsage },
        ];

        for (const { name, table } of tables) {
            describe(`${name} table`, () => {
                it("has id column", () => {
                    const cols = getColumnNames(table);
                    expect(cols).toContain("id");
                });

                it("has tenantId column", () => {
                    const cols = getColumnNames(table);
                    expect(cols).toContain("tenantId");
                });

                it("has createdAt column", () => {
                    const cols = getColumnNames(table);
                    expect(cols).toContain("createdAt");
                });

                it("has langsmithTraceId column", () => {
                    const cols = getColumnNames(table);
                    expect(cols).toContain("langsmithTraceId");
                });
            });
        }
    });

    // ── Episodes-specific columns ──────────────────────────

    describe("episodes table structure", () => {
        it("has agentType column", () => {
            expect(getColumnNames(episodes)).toContain("agentType");
        });

        it("has taskDescription column", () => {
            expect(getColumnNames(episodes)).toContain("taskDescription");
        });

        it("has outcome column", () => {
            expect(getColumnNames(episodes)).toContain("outcome");
        });

        it("has durationMs column", () => {
            expect(getColumnNames(episodes)).toContain("durationMs");
        });

        it("has metadata column", () => {
            expect(getColumnNames(episodes)).toContain("metadata");
        });
    });

    // ── Decisions-specific columns ─────────────────────────

    describe("decisions table structure", () => {
        it("has reasoning column", () => {
            expect(getColumnNames(decisions)).toContain("reasoning");
        });

        it("has contextSnapshot column", () => {
            expect(getColumnNames(decisions)).toContain("contextSnapshot");
        });

        it("has episodeId column (FK)", () => {
            expect(getColumnNames(decisions)).toContain("episodeId");
        });
    });

    // ── HITL Events columns ────────────────────────────────

    describe("hitlEvents table structure", () => {
        it("has reason column", () => {
            expect(getColumnNames(hitlEvents)).toContain("reason");
        });

        it("has userResponse column (nullable)", () => {
            expect(getColumnNames(hitlEvents)).toContain("userResponse");
        });

        it("has resolution column (nullable)", () => {
            expect(getColumnNames(hitlEvents)).toContain("resolution");
        });

        it("has episodeId column (FK)", () => {
            expect(getColumnNames(hitlEvents)).toContain("episodeId");
        });

        // Level 9 — Enhanced HITL columns
        it("has triggeredBy column", () => {
            expect(getColumnNames(hitlEvents)).toContain("triggeredBy");
        });

        it("has contextSnapshot column", () => {
            expect(getColumnNames(hitlEvents)).toContain("contextSnapshot");
        });

        it("has pauseDuration column", () => {
            expect(getColumnNames(hitlEvents)).toContain("pauseDuration");
        });
    });

    // ── File Uploads columns ───────────────────────────────

    describe("fileUploads table structure", () => {
        it("has filename column", () => {
            expect(getColumnNames(fileUploads)).toContain("filename");
        });

        it("has sizeBytes column", () => {
            expect(getColumnNames(fileUploads)).toContain("sizeBytes");
        });

        it("has chunkCount column", () => {
            expect(getColumnNames(fileUploads)).toContain("chunkCount");
        });
    });

    // ── MCP Usage columns ──────────────────────────────────

    describe("mcpUsage table structure", () => {
        it("has serverName column", () => {
            expect(getColumnNames(mcpUsage)).toContain("serverName");
        });

        it("has toolName column", () => {
            expect(getColumnNames(mcpUsage)).toContain("toolName");
        });

        it("has latencyMs column", () => {
            expect(getColumnNames(mcpUsage)).toContain("latencyMs");
        });
    });

    // ── Continuous Tasks columns (Level 9) ─────────────────

    describe("continuousTasks table structure", () => {
        it("has id column", () => {
            expect(getColumnNames(continuousTasks)).toContain("id");
        });

        it("has tenantId column", () => {
            expect(getColumnNames(continuousTasks)).toContain("tenantId");
        });

        it("has title column", () => {
            expect(getColumnNames(continuousTasks)).toContain("title");
        });

        it("has description column", () => {
            expect(getColumnNames(continuousTasks)).toContain("description");
        });

        it("has priority column", () => {
            expect(getColumnNames(continuousTasks)).toContain("priority");
        });

        it("has status column", () => {
            expect(getColumnNames(continuousTasks)).toContain("status");
        });

        it("has assignedAgent column", () => {
            expect(getColumnNames(continuousTasks)).toContain("assignedAgent");
        });

        it("has result column", () => {
            expect(getColumnNames(continuousTasks)).toContain("result");
        });

        it("has langsmithTraceId column", () => {
            expect(getColumnNames(continuousTasks)).toContain("langsmithTraceId");
        });

        it("has completedAt column", () => {
            expect(getColumnNames(continuousTasks)).toContain("completedAt");
        });

        it("has createdAt column", () => {
            expect(getColumnNames(continuousTasks)).toContain("createdAt");
        });

        it("has updatedAt column", () => {
            expect(getColumnNames(continuousTasks)).toContain("updatedAt");
        });
    });

    // ── Heartbeat Lock columns (Level 9) ───────────────────

    describe("heartbeatLock table structure", () => {
        it("has id column", () => {
            expect(getColumnNames(heartbeatLock)).toContain("id");
        });

        it("has lockHolder column", () => {
            expect(getColumnNames(heartbeatLock)).toContain("lockHolder");
        });

        it("has acquiredAt column", () => {
            expect(getColumnNames(heartbeatLock)).toContain("acquiredAt");
        });

        it("has expiresAt column", () => {
            expect(getColumnNames(heartbeatLock)).toContain("expiresAt");
        });
    });

    // ── COMMON_COLUMNS constant ────────────────────────────

    describe("COMMON_COLUMNS constant", () => {
        it("lists 4 common columns", () => {
            expect(COMMON_COLUMNS).toHaveLength(4);
        });

        it("includes id, tenant_id, created_at, langsmith_trace_id", () => {
            expect(COMMON_COLUMNS).toContain("id");
            expect(COMMON_COLUMNS).toContain("tenant_id");
            expect(COMMON_COLUMNS).toContain("created_at");
            expect(COMMON_COLUMNS).toContain("langsmith_trace_id");
        });
    });
});

