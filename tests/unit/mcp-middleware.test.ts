import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    setMCPRegistry,
    getMCPRegistry,
    buildMCPToolPrompt,
} from "baseclaw-agent/src/agents/mcp-middleware.js";
import { MCPServerRegistry } from "baseclaw-agent/src/mcp/registry.js";
import { SystemMessage } from "@langchain/core/messages";
import type { MCPServerConfig } from "baseclaw-agent/src/mcp/types.js";

/** Helper to create a valid MCPServerConfig with minimal fields. */
function makeMCPConfig(overrides: Partial<MCPServerConfig> & { id: string; name: string }): MCPServerConfig {
    return {
        url: "http://localhost:9999",
        transport: "stdio",
        description: `${overrides.name} description`,
        agentTypes: ["execution"],
        authConfig: {},
        destructiveTools: [],
        ...overrides,
    };
}

describe("MCP Middleware", () => {
    beforeEach(() => {
        // Reset registry between tests
        setMCPRegistry(null as any);
    });

    // ── Registry Getter/Setter ─────────────────────────────

    describe("setMCPRegistry / getMCPRegistry", () => {
        it("returns null when no registry is set", () => {
            expect(getMCPRegistry()).toBeNull();
        });

        it("roundtrips a registry instance", () => {
            const registry = new MCPServerRegistry();
            setMCPRegistry(registry);
            expect(getMCPRegistry()).toBe(registry);
        });

        it("can replace the registry", () => {
            const r1 = new MCPServerRegistry();
            const r2 = new MCPServerRegistry();
            setMCPRegistry(r1);
            setMCPRegistry(r2);
            expect(getMCPRegistry()).toBe(r2);
        });
    });

    // ── buildMCPToolPrompt() ───────────────────────────────

    describe("buildMCPToolPrompt()", () => {
        it("returns null when no registry is set", () => {
            const result = buildMCPToolPrompt("execution");
            expect(result).toBeNull();
        });

        it("returns null when registry has no servers for agent type", () => {
            const registry = new MCPServerRegistry();
            setMCPRegistry(registry);

            const result = buildMCPToolPrompt("execution");
            expect(result).toBeNull();
        });

        it("returns a SystemMessage when servers are attached", () => {
            const registry = new MCPServerRegistry();
            registry.registerServer(makeMCPConfig({
                id: "test-server",
                name: "Test MCP Server",
            }));
            setMCPRegistry(registry);

            const result = buildMCPToolPrompt("execution");
            expect(result).toBeInstanceOf(SystemMessage);
            expect(result!.content).toContain("Test MCP Server");
            expect(result!.content).toContain("test-server");
        });

        it("includes destructive tools in the prompt when present", () => {
            const registry = new MCPServerRegistry();
            registry.registerServer(makeMCPConfig({
                id: "danger-server",
                name: "Dangerous Server",
                destructiveTools: ["delete_all", "format_disk"],
            }));
            setMCPRegistry(registry);

            const result = buildMCPToolPrompt("execution");
            expect(result).not.toBeNull();
            const content = result!.content as string;
            expect(content).toContain("destructive");
            expect(content).toContain("delete_all");
        });

        it("returns null for agent type with no attached servers", () => {
            const registry = new MCPServerRegistry();
            registry.registerServer(makeMCPConfig({
                id: "exec-only",
                name: "Exec Only",
                agentTypes: ["execution"],
            }));
            setMCPRegistry(registry);

            const result = buildMCPToolPrompt("ideation");
            expect(result).toBeNull();
        });

        it("includes multiple servers in the prompt", () => {
            const registry = new MCPServerRegistry();
            registry.registerServer(makeMCPConfig({
                id: "server-a",
                name: "Server A",
            }));
            registry.registerServer(makeMCPConfig({
                id: "server-b",
                name: "Server B",
            }));
            setMCPRegistry(registry);

            const result = buildMCPToolPrompt("execution");
            expect(result).not.toBeNull();
            const content = result!.content as string;
            expect(content).toContain("Server A");
            expect(content).toContain("Server B");
        });
    });
});
