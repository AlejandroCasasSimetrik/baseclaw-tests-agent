import { describe, it, expect, beforeEach } from "vitest";
import { MCPAttachmentManager } from "baseclaw-agent/src/mcp/attachment.js";
import { MCPServerRegistry } from "baseclaw-agent/src/mcp/registry.js";
import type { MCPServerConfig, MCPAttachedServer } from "baseclaw-agent/src/mcp/types.js";

/** Helper config */
function makeConfig(
    overrides: Partial<MCPServerConfig> = {}
): MCPServerConfig {
    return {
        id: "test-server",
        name: "Test Server",
        url: "http://localhost:8080/mcp",
        transport: "sse",
        agentTypes: ["execution"],
        description: "Test",
        authConfig: {},
        destructiveTools: [],
        ...overrides,
    };
}

/** Helper to inject an attachment directly (bypasses network) */
function injectAttachment(
    manager: MCPAttachmentManager,
    agentId: string,
    servers: MCPAttachedServer[]
): void {
    (manager as any).attachments.set(agentId, {
        agentId,
        parentServers: [],
        ownServers: servers,
    });
}

function makeAttachedServer(
    config: MCPServerConfig,
    tools = [
        { name: "tool_a", description: "Tool A", inputSchema: {}, destructive: false },
    ]
): MCPAttachedServer {
    return {
        config,
        discoveredTools: tools,
        connectionState: "connected",
        connectedAt: new Date().toISOString(),
        reconnectAttempts: 0,
    };
}

describe("MCPAttachmentManager", () => {
    let registry: MCPServerRegistry;
    let manager: MCPAttachmentManager;

    beforeEach(() => {
        registry = new MCPServerRegistry();
        manager = new MCPAttachmentManager(registry);
    });

    // ── Attach Server ───────────────────────────────────

    describe("attachServer()", () => {
        it("throws when server is not in registry", async () => {
            await expect(
                manager.attachServer("agent-1", "nonexistent")
            ).rejects.toThrow("is not registered in the registry");
        });
    });

    // ── Detach Server ───────────────────────────────────

    describe("detachServer()", () => {
        it("removes server from agent's attached set", async () => {
            const config = makeConfig({ id: "fs-server" });
            injectAttachment(manager, "agent-1", [
                makeAttachedServer(config),
            ]);

            const result = await manager.detachServer("agent-1", "fs-server");
            expect(result).toBe(true);
            expect(manager.getAttachedServers("agent-1")).toHaveLength(0);
        });

        it("returns false when server is not attached", async () => {
            const result = await manager.detachServer("agent-1", "nonexistent");
            expect(result).toBe(false);
        });

        it("returns false when agent has no attachments", async () => {
            const result = await manager.detachServer("no-agent", "server");
            expect(result).toBe(false);
        });
    });

    // ── Get Attached Servers ────────────────────────────

    describe("getAttachedServers()", () => {
        it("returns empty array for unknown agent", () => {
            expect(manager.getAttachedServers("unknown")).toEqual([]);
        });

        it("returns all attached servers for an agent", () => {
            const configA = makeConfig({ id: "server-a" });
            const configB = makeConfig({ id: "server-b" });
            injectAttachment(manager, "agent-1", [
                makeAttachedServer(configA),
                makeAttachedServer(configB),
            ]);

            expect(manager.getAttachedServers("agent-1")).toHaveLength(2);
        });
    });

    // ── Get Available Tools ─────────────────────────────

    describe("getAvailableTools()", () => {
        it("returns empty array for unknown agent", () => {
            expect(manager.getAvailableTools("unknown")).toEqual([]);
        });

        it("returns all tools from all attached servers", () => {
            const config = makeConfig({ id: "multi-tool" });
            injectAttachment(manager, "agent-1", [
                makeAttachedServer(config, [
                    { name: "tool_1", description: "T1", inputSchema: {}, destructive: false },
                    { name: "tool_2", description: "T2", inputSchema: {}, destructive: true },
                ]),
            ]);

            const tools = manager.getAvailableTools("agent-1");
            expect(tools).toHaveLength(2);
            expect(tools[0].serverId).toBe("multi-tool");
            expect(tools[0].tool.name).toBe("tool_1");
            expect(tools[1].tool.name).toBe("tool_2");
        });
    });

    // ── Get Attached Server By ID ───────────────────────

    describe("getAttachedServerById()", () => {
        it("finds a server by ID", () => {
            const config = makeConfig({ id: "target" });
            injectAttachment(manager, "agent-1", [
                makeAttachedServer(config),
            ]);

            const found = manager.getAttachedServerById("agent-1", "target");
            expect(found).toBeDefined();
            expect(found!.config.id).toBe("target");
        });

        it("returns undefined for unknown server", () => {
            expect(
                manager.getAttachedServerById("agent-1", "nonexistent")
            ).toBeUndefined();
        });
    });

    // ── Sub-Agent Inheritance ───────────────────────────

    describe("inheritServers()", () => {
        it("copies parent servers to child as parentServers", () => {
            const parentConfig = makeConfig({ id: "parent-server" });
            injectAttachment(manager, "parent-agent", [
                makeAttachedServer(parentConfig),
            ]);

            manager.inheritServers("child-agent", "parent-agent");

            const childAttachment = (manager as any).attachments.get("child-agent");
            expect(childAttachment.parentServers).toHaveLength(1);
            expect(childAttachment.parentServers[0].config.id).toBe("parent-server");
            expect(childAttachment.ownServers).toHaveLength(0);
        });

        it("child can still have own servers alongside inherited", () => {
            const parentConfig = makeConfig({ id: "parent-server" });
            const childConfig = makeConfig({ id: "child-server" });

            injectAttachment(manager, "parent-agent", [
                makeAttachedServer(parentConfig),
            ]);

            manager.inheritServers("child-agent", "parent-agent");

            // Add child's own server
            const childAttachment = (manager as any).attachments.get("child-agent");
            childAttachment.ownServers.push(makeAttachedServer(childConfig));

            // Total attached = parent (1) + own (1)
            const allServers = manager.getAttachedServers("child-agent");
            expect(allServers).toHaveLength(2);
        });

        it("does nothing if parent has no attachments", () => {
            manager.inheritServers("child", "nonexistent-parent");

            // Child should not have been created
            expect(manager.getAttachedServers("child")).toEqual([]);
        });
    });

    // ── callTool ────────────────────────────────────────

    describe("callTool()", () => {
        it("returns failure when no handle exists", async () => {
            injectAttachment(manager, "agent-1", [
                makeAttachedServer(makeConfig()),
            ]);

            const result = await manager.callTool(
                "agent-1",
                "test-server",
                "read_file",
                { path: "/test" }
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("No active connection");
        });
    });

    // ── Utility ─────────────────────────────────────────

    describe("clear()", () => {
        it("removes all attachments", () => {
            injectAttachment(manager, "agent-1", [
                makeAttachedServer(makeConfig()),
            ]);

            manager.clear();
            expect(manager.agentCount).toBe(0);
        });
    });
});
