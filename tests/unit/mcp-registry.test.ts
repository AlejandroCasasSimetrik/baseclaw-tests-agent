import { describe, it, expect, beforeEach, vi } from "vitest";
import { MCPServerRegistry } from "baseclaw-agent/src/mcp/registry.js";
import type { MCPServerConfig } from "baseclaw-agent/src/mcp/types.js";

/** Helper to create a valid MCP server config */
function makeServerConfig(
    overrides: Partial<MCPServerConfig> = {}
): MCPServerConfig {
    return {
        id: "test-server",
        name: "Test MCP Server",
        url: "http://localhost:8080/mcp",
        transport: "sse",
        agentTypes: ["execution"],
        description: "A test MCP server",
        authConfig: {},
        destructiveTools: [],
        ...overrides,
    };
}

describe("MCPServerRegistry", () => {
    let registry: MCPServerRegistry;

    beforeEach(() => {
        registry = new MCPServerRegistry();
    });

    // ── Registration ────────────────────────────────────

    describe("registerServer()", () => {
        it("registers a server successfully", () => {
            const config = makeServerConfig();
            registry.registerServer(config);
            expect(registry.size).toBe(1);
            expect(registry.getServer("test-server")).toBe(config);
        });

        it("throws on duplicate server ID", () => {
            registry.registerServer(makeServerConfig());
            expect(() => registry.registerServer(makeServerConfig())).toThrow(
                'MCP server "test-server" is already registered'
            );
        });

        it("registers multiple servers with different IDs", () => {
            registry.registerServer(makeServerConfig({ id: "server-a" }));
            registry.registerServer(makeServerConfig({ id: "server-b" }));
            registry.registerServer(makeServerConfig({ id: "server-c" }));
            expect(registry.size).toBe(3);
        });

        it("throws when required credentials are missing", () => {
            expect(() =>
                registry.registerServer(
                    makeServerConfig({
                        id: "needs-creds",
                        authConfig: { apiKey: "MISSING_ENV_VAR_XYZ_123" },
                    })
                )
            ).toThrow("requires credentials that are not set");
        });

        it("succeeds when referenced env vars exist", () => {
            // OPENAI_API_KEY should exist in .env
            const config = makeServerConfig({
                id: "has-creds",
                authConfig: { apiKey: "PATH" }, // PATH exists on all systems
            });
            registry.registerServer(config);
            expect(registry.size).toBe(1);
        });
    });

    // ── Unregistration ──────────────────────────────────

    describe("unregisterServer()", () => {
        it("removes a registered server", () => {
            registry.registerServer(makeServerConfig());
            expect(registry.unregisterServer("test-server")).toBe(true);
            expect(registry.size).toBe(0);
        });

        it("returns false for unknown server ID", () => {
            expect(registry.unregisterServer("nonexistent")).toBe(false);
        });
    });

    // ── Querying ────────────────────────────────────────

    describe("getServer()", () => {
        it("returns the config for a valid ID", () => {
            const config = makeServerConfig();
            registry.registerServer(config);
            expect(registry.getServer("test-server")).toBe(config);
        });

        it("returns undefined for unknown ID", () => {
            expect(registry.getServer("nonexistent")).toBeUndefined();
        });
    });

    describe("getAvailableServers()", () => {
        it("returns empty array when registry is empty", () => {
            expect(registry.getAvailableServers()).toEqual([]);
        });

        it("returns all registered servers", () => {
            registry.registerServer(makeServerConfig({ id: "a" }));
            registry.registerServer(makeServerConfig({ id: "b" }));
            expect(registry.getAvailableServers()).toHaveLength(2);
        });
    });

    describe("getServersForAgent()", () => {
        it("returns servers for the specified agent type", () => {
            registry.registerServer(
                makeServerConfig({ id: "exec-server", agentTypes: ["execution"] })
            );
            registry.registerServer(
                makeServerConfig({ id: "plan-server", agentTypes: ["planning"] })
            );

            const execServers = registry.getServersForAgent("execution");
            expect(execServers).toHaveLength(1);
            expect(execServers[0].id).toBe("exec-server");
        });

        it("returns servers with agentTypes 'all'", () => {
            registry.registerServer(
                makeServerConfig({ id: "universal", agentTypes: "all" })
            );

            expect(registry.getServersForAgent("execution")).toHaveLength(1);
            expect(registry.getServersForAgent("planning")).toHaveLength(1);
            expect(registry.getServersForAgent("ideation")).toHaveLength(1);
        });

        it("returns empty for agent with no servers", () => {
            registry.registerServer(
                makeServerConfig({ id: "exec-only", agentTypes: ["execution"] })
            );
            expect(registry.getServersForAgent("reviewer")).toHaveLength(0);
        });
    });

    // ── Credential Validation ───────────────────────────

    describe("validateCredentials()", () => {
        it("returns true when no credentials required", () => {
            const config = makeServerConfig({ authConfig: {} });
            expect(registry.validateCredentials(config)).toBe(true);
        });

        it("returns false when env var is missing", () => {
            const config = makeServerConfig({
                authConfig: { token: "NONEXISTENT_VAR_ABC_123" },
            });
            expect(registry.validateCredentials(config)).toBe(false);
        });

        it("returns true when env var exists", () => {
            const config = makeServerConfig({
                authConfig: { path: "PATH" },
            });
            expect(registry.validateCredentials(config)).toBe(true);
        });
    });

    describe("getMissingCredentials()", () => {
        it("returns empty array when all credentials present", () => {
            const config = makeServerConfig({ authConfig: { path: "PATH" } });
            expect(registry.getMissingCredentials(config)).toEqual([]);
        });

        it("returns missing env var names", () => {
            const config = makeServerConfig({
                authConfig: {
                    token: "MISSING_VAR_XYZ_999",
                    secret: "ANOTHER_MISSING_VAR",
                },
            });
            const missing = registry.getMissingCredentials(config);
            expect(missing).toContain("MISSING_VAR_XYZ_999");
            expect(missing).toContain("ANOTHER_MISSING_VAR");
        });
    });

    // ── Inheritance (Level 8 Prep) ──────────────────────

    describe("getInheritedServers()", () => {
        it("returns servers shared between parent and child agent types", () => {
            registry.registerServer(
                makeServerConfig({
                    id: "shared",
                    agentTypes: ["execution", "planning"],
                })
            );
            registry.registerServer(
                makeServerConfig({
                    id: "exec-only",
                    agentTypes: ["execution"],
                })
            );

            const inherited = registry.getInheritedServers("planning", "execution");
            expect(inherited).toHaveLength(1);
            expect(inherited[0].id).toBe("shared");
        });

        it("returns all parent servers when agentTypes is 'all'", () => {
            registry.registerServer(
                makeServerConfig({ id: "universal", agentTypes: "all" })
            );

            const inherited = registry.getInheritedServers("planning", "execution");
            expect(inherited).toHaveLength(1);
        });
    });

    // ── Utility ─────────────────────────────────────────

    describe("clear()", () => {
        it("removes all servers", () => {
            registry.registerServer(makeServerConfig({ id: "a" }));
            registry.registerServer(makeServerConfig({ id: "b" }));
            registry.clear();
            expect(registry.size).toBe(0);
            expect(registry.getAvailableServers()).toEqual([]);
        });
    });
});
