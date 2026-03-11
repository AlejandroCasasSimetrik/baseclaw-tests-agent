import { describe, it, expect } from "vitest";
import {
    isValidTransport,
    isValidServerConfig,
} from "baseclaw-agent/src/mcp/types.js";
import type { MCPServerConfig } from "baseclaw-agent/src/mcp/types.js";

describe("MCP Types — Validation Helpers", () => {
    // ── isValidTransport ──────────────────────────────────

    describe("isValidTransport()", () => {
        it("returns true for 'sse'", () => {
            expect(isValidTransport("sse")).toBe(true);
        });

        it("returns true for 'stdio'", () => {
            expect(isValidTransport("stdio")).toBe(true);
        });

        it("returns false for invalid strings", () => {
            expect(isValidTransport("http")).toBe(false);
            expect(isValidTransport("websocket")).toBe(false);
            expect(isValidTransport("")).toBe(false);
        });

        it("returns false for non-string values", () => {
            expect(isValidTransport(42)).toBe(false);
            expect(isValidTransport(null)).toBe(false);
            expect(isValidTransport(undefined)).toBe(false);
        });
    });

    // ── isValidServerConfig ───────────────────────────────

    describe("isValidServerConfig()", () => {
        function makeConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
            return {
                id: "test-server",
                name: "Test Server",
                url: "http://localhost:8080/mcp",
                transport: "sse",
                agentTypes: ["execution"],
                description: "A test MCP server",
                authConfig: {},
                destructiveTools: [],
                ...overrides,
            };
        }

        it("returns true for a valid config", () => {
            expect(isValidServerConfig(makeConfig())).toBe(true);
        });

        it("returns true when agentTypes is 'all'", () => {
            expect(isValidServerConfig(makeConfig({ agentTypes: "all" }))).toBe(true);
        });

        it("returns false when id is missing", () => {
            expect(isValidServerConfig(makeConfig({ id: "" }))).toBe(false);
        });

        it("returns false when name is missing", () => {
            expect(isValidServerConfig(makeConfig({ name: "" }))).toBe(false);
        });

        it("returns false when url is missing", () => {
            expect(isValidServerConfig(makeConfig({ url: "" }))).toBe(false);
        });

        it("returns false for invalid transport", () => {
            expect(
                isValidServerConfig({ ...makeConfig(), transport: "invalid" as any })
            ).toBe(false);
        });

        it("returns false for null", () => {
            expect(isValidServerConfig(null)).toBe(false);
        });

        it("returns false for undefined", () => {
            expect(isValidServerConfig(undefined)).toBe(false);
        });

        it("returns false for non-object", () => {
            expect(isValidServerConfig("string")).toBe(false);
            expect(isValidServerConfig(42)).toBe(false);
        });

        it("returns false when authConfig is null", () => {
            expect(
                isValidServerConfig({ ...makeConfig(), authConfig: null as any })
            ).toBe(false);
        });

        it("returns false when destructiveTools is not an array", () => {
            expect(
                isValidServerConfig({
                    ...makeConfig(),
                    destructiveTools: "not-array" as any,
                })
            ).toBe(false);
        });
    });
});
