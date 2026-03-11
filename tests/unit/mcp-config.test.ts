import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadMCPConfig, registerServersFromConfig } from "baseclaw-agent/src/mcp/config.js";
import { MCPServerRegistry } from "baseclaw-agent/src/mcp/registry.js";
import type { MCPServerConfig } from "baseclaw-agent/src/mcp/types.js";

// We'll use /tmp for test config files
const TEST_CONFIG_DIR = "/tmp/mcp-config-test";

function makeTempConfig(servers: MCPServerConfig[]): string {
    const filePath = path.join(TEST_CONFIG_DIR, `mcp-config-${Date.now()}.json`);
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
        fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify({ servers }), "utf-8");
    return filePath;
}

function makeValidServer(id: string = "test-server"): MCPServerConfig {
    return {
        id,
        name: "Test Server",
        url: "http://localhost:8080/mcp",
        transport: "sse",
        agentTypes: ["execution"],
        description: "Test",
        authConfig: {},
        destructiveTools: [],
    };
}

afterEach(() => {
    // Clean up tmp files
    if (fs.existsSync(TEST_CONFIG_DIR)) {
        const files = fs.readdirSync(TEST_CONFIG_DIR);
        for (const file of files) {
            fs.unlinkSync(path.join(TEST_CONFIG_DIR, file));
        }
    }
});

describe("MCP Config Loader", () => {
    // ── loadMCPConfig ───────────────────────────────────

    describe("loadMCPConfig()", () => {
        it("returns empty array when file doesn't exist", () => {
            const result = loadMCPConfig("/tmp/nonexistent-mcp-config.json");
            expect(result).toEqual([]);
        });

        it("loads valid config file", () => {
            const filePath = makeTempConfig([makeValidServer()]);
            const result = loadMCPConfig(filePath);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("test-server");
        });

        it("loads multiple servers", () => {
            const filePath = makeTempConfig([
                makeValidServer("server-a"),
                makeValidServer("server-b"),
            ]);
            const result = loadMCPConfig(filePath);
            expect(result).toHaveLength(2);
        });

        it("throws on malformed JSON", () => {
            const filePath = path.join(TEST_CONFIG_DIR, "bad.json");
            if (!fs.existsSync(TEST_CONFIG_DIR)) {
                fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            }
            fs.writeFileSync(filePath, "not json {{{", "utf-8");

            expect(() => loadMCPConfig(filePath)).toThrow("Failed to parse");
        });

        it("throws when file has wrong format (missing servers array)", () => {
            const filePath = path.join(TEST_CONFIG_DIR, "wrong-format.json");
            if (!fs.existsSync(TEST_CONFIG_DIR)) {
                fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify({ notServers: [] }), "utf-8");

            expect(() => loadMCPConfig(filePath)).toThrow(
                'expected { "servers": [...] }'
            );
        });

        it("throws on invalid server config in array", () => {
            const filePath = path.join(TEST_CONFIG_DIR, "invalid-server.json");
            if (!fs.existsSync(TEST_CONFIG_DIR)) {
                fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            }
            fs.writeFileSync(
                filePath,
                JSON.stringify({
                    servers: [{ id: "" }], // Missing required fields
                }),
                "utf-8"
            );

            expect(() => loadMCPConfig(filePath)).toThrow("validation errors");
        });
    });

    // ── registerServersFromConfig ────────────────────────

    describe("registerServersFromConfig()", () => {
        it("registers all valid servers", () => {
            const registry = new MCPServerRegistry();
            const configs = [
                makeValidServer("a"),
                makeValidServer("b"),
            ];

            const registered = registerServersFromConfig(registry, configs);
            expect(registered).toEqual(["a", "b"]);
            expect(registry.size).toBe(2);
        });

        it("skips servers with missing credentials (does not throw)", () => {
            const registry = new MCPServerRegistry();
            const configs = [
                makeValidServer("good-server"),
                makeValidServer("needs-creds"),
            ];
            // Make the second one require missing creds
            (configs[1] as any).authConfig = { token: "MISSING_ENV_VAR_XYZ" };

            // Should not throw, should just skip the bad server
            const registered = registerServersFromConfig(registry, configs);
            expect(registered).toEqual(["good-server"]);
            expect(registry.size).toBe(1);
        });

        it("returns empty array for empty config", () => {
            const registry = new MCPServerRegistry();
            const registered = registerServersFromConfig(registry, []);
            expect(registered).toEqual([]);
        });
    });
});
