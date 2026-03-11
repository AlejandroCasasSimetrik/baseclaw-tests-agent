import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPClient } from "baseclaw-agent/src/mcp/client.js";
import type { MCPConnectionHandle } from "baseclaw-agent/src/mcp/client.js";
import type { MCPServerConfig } from "baseclaw-agent/src/mcp/types.js";

/** Helper to create a test MCP server config */
function makeConfig(
    overrides: Partial<MCPServerConfig> = {}
): MCPServerConfig {
    return {
        id: "test-server",
        name: "Test Server",
        url: "http://localhost:9999/mcp",
        transport: "sse",
        agentTypes: ["execution"],
        description: "Test",
        authConfig: {},
        destructiveTools: ["delete_file"],
        ...overrides,
    };
}

/** Helper to create a connected handle (bypasses actual network) */
function makeConnectedHandle(
    config?: MCPServerConfig
): MCPConnectionHandle {
    return {
        config: config ?? makeConfig(),
        state: "connected",
        reconnectAttempts: 0,
        connectedAt: new Date().toISOString(),
        inFlightCalls: 0,
    };
}

describe("MCPClient", () => {
    let client: MCPClient;

    beforeEach(() => {
        client = new MCPClient(
            { baseDelayMs: 10, maxDelayMs: 50, maxRetries: 2 },
            1000
        );
    });

    // ── Connection ──────────────────────────────────────

    describe("connect()", () => {
        it("throws for stdio transport (not yet implemented)", async () => {
            const config = makeConfig({ transport: "stdio" });
            await expect(client.connect(config)).rejects.toThrow(
                "stdio transport is not yet implemented"
            );
        });

        it("throws when server is unreachable", async () => {
            const config = makeConfig({ url: "http://localhost:1/unreachable" });
            await expect(client.connect(config)).rejects.toThrow(
                "Failed to connect"
            );
        });
    });

    // ── Disconnect ──────────────────────────────────────

    describe("disconnect()", () => {
        it("sets handle state to disconnected", async () => {
            const handle = makeConnectedHandle();
            await client.disconnect(handle);
            expect(handle.state).toBe("disconnected");
            expect(handle.reconnectAttempts).toBe(0);
        });
    });

    // ── Connection State ────────────────────────────────

    describe("getConnectionState()", () => {
        it("returns the current state", () => {
            const handle = makeConnectedHandle();
            expect(client.getConnectionState(handle)).toBe("connected");

            handle.state = "error";
            expect(client.getConnectionState(handle)).toBe("error");
        });
    });

    // ── listTools ───────────────────────────────────────

    describe("listTools()", () => {
        it("throws when not connected", async () => {
            const handle = makeConnectedHandle();
            handle.state = "disconnected";
            await expect(client.listTools(handle)).rejects.toThrow(
                "is not connected"
            );
        });
    });

    // ── callTool ────────────────────────────────────────

    describe("callTool()", () => {
        it("throws when not connected", async () => {
            const handle = makeConnectedHandle();
            handle.state = "disconnected";

            await expect(
                client.callTool(handle, "test_tool", {})
            ).rejects.toThrow("is not connected");
        });

        it("returns failed result with error details on connection error", async () => {
            const handle = makeConnectedHandle();
            // The tool call will fail because there's no actual server
            const result = await client.callTool(handle, "test_tool", { key: "value" });
            expect(result.success).toBe(false);
            expect(result.serverId).toBe("test-server");
            expect(result.toolName).toBe("test_tool");
            expect(result.error).toBeDefined();
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
            expect(result.timestamp).toBeTruthy();
        });

        it("tracks in-flight calls correctly", async () => {
            const handle = makeConnectedHandle();
            expect(handle.inFlightCalls).toBe(0);

            // Start a call (it will fail but in-flight should be proper)
            await client.callTool(handle, "test_tool", {});
            expect(handle.inFlightCalls).toBe(0); // Decremented in finally
        });
    });

    // ── Reconnect ───────────────────────────────────────

    describe("reconnect()", () => {
        it("returns false when max retries exhausted", async () => {
            const handle = makeConnectedHandle();
            handle.state = "error";

            const result = await client.reconnect(handle);
            expect(result).toBe(false);
            expect(handle.state).toBe("error");
        });

        it("tracks reconnect attempts", async () => {
            const handle = makeConnectedHandle();
            handle.state = "error";

            await client.reconnect(handle);
            // After exhausting retries, state should be error
            expect(handle.state).toBe("error");
        });
    });

    // ── Backoff Configuration ───────────────────────────

    describe("backoff configuration", () => {
        it("uses custom backoff settings", () => {
            const customClient = new MCPClient(
                { baseDelayMs: 500, maxDelayMs: 5000, maxRetries: 3 },
                10000
            );
            expect(customClient).toBeDefined();
        });

        it("uses default backoff when not specified", () => {
            const defaultClient = new MCPClient();
            expect(defaultClient).toBeDefined();
        });
    });
});
