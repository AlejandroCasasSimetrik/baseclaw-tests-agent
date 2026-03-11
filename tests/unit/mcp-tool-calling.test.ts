import { describe, it, expect } from "vitest";
import {
    isDestructiveAction,
    createConfirmationRequest,
    captureToolResult,
    buildMcpUsageLog,
} from "baseclaw-agent/src/mcp/tool-calling.js";
import { MCPAttachmentManager } from "baseclaw-agent/src/mcp/attachment.js";
import { MCPServerRegistry } from "baseclaw-agent/src/mcp/registry.js";
import { createWorkingMemory } from "baseclaw-agent/src/memory/working-memory.js";
import type { MCPToolCallResult } from "baseclaw-agent/src/mcp/types.js";

/** Helper to create a mock attachment manager with a pre-populated server */
function createMockManager(): MCPAttachmentManager {
    const registry = new MCPServerRegistry();
    const manager = new MCPAttachmentManager(registry);

    // Manually inject an attachment for testing (bypass actual connection)
    (manager as any).attachments.set("agent-1", {
        agentId: "agent-1",
        parentServers: [],
        ownServers: [
            {
                config: {
                    id: "test-server",
                    name: "Test Server",
                    url: "http://localhost:8080/mcp",
                    transport: "sse",
                    agentTypes: ["execution"],
                    description: "Test",
                    authConfig: {},
                    destructiveTools: ["delete_file"],
                },
                discoveredTools: [
                    {
                        name: "read_file",
                        description: "Read a file",
                        inputSchema: {},
                        destructive: false,
                    },
                    {
                        name: "delete_file",
                        description: "Delete a file",
                        inputSchema: {},
                        destructive: true,
                    },
                ],
                connectionState: "connected",
                connectedAt: new Date().toISOString(),
                reconnectAttempts: 0,
            },
        ],
    });

    return manager;
}

/** Helper to create a test MCPToolCallResult */
function makeResult(
    overrides: Partial<MCPToolCallResult> = {}
): MCPToolCallResult {
    return {
        serverId: "test-server",
        serverName: "Test Server",
        toolName: "read_file",
        input: { path: "/tmp/test.txt" },
        output: { content: "Hello World" },
        success: true,
        latencyMs: 42,
        timestamp: new Date().toISOString(),
        ...overrides,
    };
}

describe("MCP Tool Calling", () => {
    // ── isDestructiveAction ─────────────────────────────

    describe("isDestructiveAction()", () => {
        it("returns true for destructive tools", () => {
            const manager = createMockManager();
            expect(
                isDestructiveAction("test-server", "delete_file", "agent-1", manager)
            ).toBe(true);
        });

        it("returns false for non-destructive tools", () => {
            const manager = createMockManager();
            expect(
                isDestructiveAction("test-server", "read_file", "agent-1", manager)
            ).toBe(false);
        });

        it("returns false for unknown server", () => {
            const manager = createMockManager();
            expect(
                isDestructiveAction("unknown-server", "delete_file", "agent-1", manager)
            ).toBe(false);
        });

        it("returns false for unknown tool", () => {
            const manager = createMockManager();
            expect(
                isDestructiveAction("test-server", "unknown_tool", "agent-1", manager)
            ).toBe(false);
        });
    });

    // ── createConfirmationRequest ────────────────────────

    describe("createConfirmationRequest()", () => {
        it("creates a confirmation request with sanitized input", () => {
            const request = createConfirmationRequest("test-server", "delete_file", {
                path: "/important/file",
            });

            expect(request.serverId).toBe("test-server");
            expect(request.toolName).toBe("delete_file");
            expect(request.sanitizedInput).toEqual({ path: "/important/file" });
            expect(request.actionDescription).toContain("destructive");
            expect(request.approved).toBeUndefined();
        });

        it("sanitizes credentials in input", () => {
            const request = createConfirmationRequest("server", "tool", {
                key: "sk-proj-FakeKey123456789012345678901234567890",
            });

            // The sanitizer should have redacted the key
            expect(JSON.stringify(request.sanitizedInput)).toContain("[REDACTED]");
        });
    });

    // ── captureToolResult ───────────────────────────────

    describe("captureToolResult()", () => {
        it("adds result to working memory mcpCallResults", () => {
            const wm = createWorkingMemory("task-1", "tenant-1", "Test task");
            const result = makeResult();

            const updated = captureToolResult(result, wm);

            expect(updated.mcpCallResults).toHaveLength(1);
            expect(updated.mcpCallResults[0].serverName).toBe("Test Server");
            expect(updated.mcpCallResults[0].toolName).toBe("read_file");
        });

        it("appends to existing mcpCallResults", () => {
            let wm = createWorkingMemory("task-1", "tenant-1", "Test task");
            wm = captureToolResult(makeResult({ toolName: "tool_a" }), wm);
            wm = captureToolResult(makeResult({ toolName: "tool_b" }), wm);

            expect(wm.mcpCallResults).toHaveLength(2);
            expect(wm.mcpCallResults[0].toolName).toBe("tool_a");
            expect(wm.mcpCallResults[1].toolName).toBe("tool_b");
        });

        it("captures error for failed results", () => {
            const wm = createWorkingMemory("task-1", "tenant-1", "Test task");
            const result = makeResult({
                success: false,
                output: null,
                error: "Connection refused",
            });

            const updated = captureToolResult(result, wm);
            expect(updated.mcpCallResults[0].output).toContain("ERROR: Connection refused");
        });
    });

    // ── buildMcpUsageLog ────────────────────────────────

    describe("buildMcpUsageLog()", () => {
        it("builds a valid log entry", () => {
            const result = makeResult();
            const log = buildMcpUsageLog(result, "episode-1", "trace-1");

            expect(log.serverName).toBe("Test Server");
            expect(log.toolName).toBe("read_file");
            expect(log.episodeId).toBe("episode-1");
            expect(log.langsmithTraceId).toBe("trace-1");
            expect(log.latencyMs).toBe(42);
            expect(log.inputSummary).toContain("/tmp/test.txt");
            expect(log.outputSummary).toContain("Hello World");
        });

        it("truncates long summaries to 500 chars", () => {
            const longOutput = "x".repeat(1000);
            const result = makeResult({ output: longOutput });
            const log = buildMcpUsageLog(result, "ep", "trace");

            expect(log.outputSummary.length).toBeLessThanOrEqual(500);
        });

        it("handles failed results", () => {
            const result = makeResult({
                success: false,
                output: null,
                error: "Server error",
            });
            const log = buildMcpUsageLog(result, "ep", "trace");

            expect(log.outputSummary).toContain("ERROR: Server error");
        });
    });
});
