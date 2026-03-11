import { describe, it, expect } from "vitest";
import { sanitizeTraceData, containsSensitiveData } from "baseclaw-agent/src/observability/sanitizer.js";
import { createConfirmationRequest } from "baseclaw-agent/src/mcp/tool-calling.js";
import { isValidServerConfig } from "baseclaw-agent/src/mcp/types.js";
import type { MCPServerConfig, MCPToolCallResult } from "baseclaw-agent/src/mcp/types.js";

describe("MCP Security", () => {
    // ── Credential Isolation ────────────────────────────

    describe("Credentials never in registry", () => {
        it("authConfig stores env var NAMES, not values", () => {
            const config: MCPServerConfig = {
                id: "secure-server",
                name: "Secure Server",
                url: "http://localhost:8080/mcp",
                transport: "sse",
                agentTypes: ["execution"],
                description: "Test",
                authConfig: {
                    apiKey: "GITHUB_TOKEN",
                    secret: "SLACK_SECRET",
                },
                destructiveTools: [],
            };

            // The authConfig should store names, not values
            expect(config.authConfig.apiKey).toBe("GITHUB_TOKEN");
            expect(config.authConfig.secret).toBe("SLACK_SECRET");

            // Verify the config is valid structurally
            expect(isValidServerConfig(config)).toBe(true);

            // Serialize the config — no actual credential values should be present
            const serialized = JSON.stringify(config);
            expect(serialized).not.toContain("ghp_"); // No GitHub token patterns
            expect(serialized).not.toContain("xoxb-"); // No Slack token patterns
        });
    });

    // ── Trace Sanitization ──────────────────────────────

    describe("Trace sanitization on MCP I/O", () => {
        it("sanitizes API keys in tool call inputs", () => {
            const input = {
                query: "test",
                apiKey: "sk-proj-FakeKey123456789012345678901234567890",
            };

            const sanitized = sanitizeTraceData(input);
            expect(JSON.stringify(sanitized)).toContain("[REDACTED]");
            expect(JSON.stringify(sanitized)).not.toContain("sk-proj-");
        });

        it("sanitizes credentials in tool call outputs", () => {
            const output = {
                result: "Found: api_key=sk-proj-AnotherFakeKey12345678901234",
            };

            const sanitized = sanitizeTraceData(output);
            expect(JSON.stringify(sanitized)).toContain("[REDACTED]");
        });

        it("sanitizes email addresses in MCP data", () => {
            const data = {
                user: "admin@secret-company.com",
                query: "test",
            };

            const sanitized = sanitizeTraceData(data);
            expect(JSON.stringify(sanitized)).toContain("[REDACTED]");
        });

        it("sanitizes PostgreSQL connection strings", () => {
            const data = {
                config: "postgresql://admin:password@host:5432/prod",
            };

            const sanitized = sanitizeTraceData(data);
            expect(JSON.stringify(sanitized)).toContain("[REDACTED]");
        });

        it("sanitizes Pinecone keys", () => {
            const data = {
                key: "pcsk_abc123def456ghi789",
            };

            const sanitized = sanitizeTraceData(data);
            expect(JSON.stringify(sanitized)).toContain("[REDACTED]");
        });
    });

    // ── Destructive Action Gating ───────────────────────

    describe("Destructive action confirmation", () => {
        it("createConfirmationRequest sanitizes input", () => {
            const request = createConfirmationRequest("server-1", "delete_file", {
                path: "/data",
                token: "sk-proj-TestKey123456789012345678901234567890",
            });

            // Input should be sanitized
            expect(
                JSON.stringify(request.sanitizedInput)
            ).not.toContain("sk-proj-");
            expect(JSON.stringify(request.sanitizedInput)).toContain("[REDACTED]");

            // Request should describe the action
            expect(request.actionDescription).toContain("destructive");
            expect(request.serverId).toBe("server-1");
            expect(request.toolName).toBe("delete_file");
        });

        it("confirmation is pending by default (not auto-approved)", () => {
            const request = createConfirmationRequest("s", "t", {});
            expect(request.approved).toBeUndefined();
        });
    });

    // ── Tool Response Validation ────────────────────────

    describe("Tool response validation", () => {
        it("MCPToolCallResult captures error on failure", () => {
            const result: MCPToolCallResult = {
                serverId: "server-1",
                serverName: "Server 1",
                toolName: "read_file",
                input: { path: "/test" },
                output: null,
                success: false,
                error: "Connection refused",
                latencyMs: 100,
                timestamp: new Date().toISOString(),
            };

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.output).toBeNull();
        });

        it("MCPToolCallResult captures valid output on success", () => {
            const result: MCPToolCallResult = {
                serverId: "server-1",
                serverName: "Server 1",
                toolName: "read_file",
                input: { path: "/test" },
                output: { content: "file contents" },
                success: true,
                latencyMs: 42,
                timestamp: new Date().toISOString(),
            };

            expect(result.success).toBe(true);
            expect(result.output).toEqual({ content: "file contents" });
            expect(result.error).toBeUndefined();
        });
    });

    // ── Data Model Isolation ────────────────────────────

    describe("Server process isolation", () => {
        it("server config does not contain agent state references", () => {
            const config: MCPServerConfig = {
                id: "isolated",
                name: "Isolated Server",
                url: "http://localhost:8080/mcp",
                transport: "sse",
                agentTypes: ["execution"],
                description: "Runs as separate process",
                authConfig: {},
                destructiveTools: [],
            };

            // Config should only contain connection metadata
            const keys = Object.keys(config);
            expect(keys).not.toContain("memory");
            expect(keys).not.toContain("state");
            expect(keys).not.toContain("agentInternals");
        });
    });
});
