import { describe, it, expect } from "vitest";
import {
    validateToolDefinition,
    formatToolsForContext,
    formatInputSchema,
    mergeToolContextWithSkills,
} from "baseclaw-agent/src/mcp/tool-discovery.js";
import type { MCPToolDefinition } from "baseclaw-agent/src/mcp/types.js";

/** Helper to create a valid tool definition */
function makeTool(
    overrides: Partial<MCPToolDefinition> = {}
): MCPToolDefinition {
    return {
        name: "read_file",
        description: "Read the contents of a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File path to read" },
            },
            required: ["path"],
        },
        destructive: false,
        ...overrides,
    };
}

describe("MCP Tool Discovery", () => {
    // ── validateToolDefinition ───────────────────────────

    describe("validateToolDefinition()", () => {
        it("returns true for a valid tool", () => {
            expect(validateToolDefinition(makeTool())).toBe(true);
        });

        it("returns false when name is empty", () => {
            expect(validateToolDefinition(makeTool({ name: "" }))).toBe(false);
        });

        it("returns false when name is not a string", () => {
            expect(
                validateToolDefinition(makeTool({ name: 42 as any }))
            ).toBe(false);
        });

        it("returns false when description is not a string", () => {
            expect(
                validateToolDefinition(makeTool({ description: null as any }))
            ).toBe(false);
        });

        it("returns false when inputSchema is null", () => {
            expect(
                validateToolDefinition(makeTool({ inputSchema: null as any }))
            ).toBe(false);
        });

        it("allows empty inputSchema object", () => {
            expect(validateToolDefinition(makeTool({ inputSchema: {} }))).toBe(
                true
            );
        });
    });

    // ── formatToolsForContext ────────────────────────────

    describe("formatToolsForContext()", () => {
        it("returns empty string for no tools", () => {
            expect(formatToolsForContext("server-1", "Server 1", [])).toBe("");
        });

        it("formats tools with server info", () => {
            const tools = [makeTool()];
            const result = formatToolsForContext("fs-server", "Filesystem", tools);

            expect(result).toContain("[MCP Server: Filesystem (fs-server)]");
            expect(result).toContain("read_file");
            expect(result).toContain("Read the contents of a file");
        });

        it("marks destructive tools with warning", () => {
            const tools = [makeTool({ name: "delete_file", destructive: true })];
            const result = formatToolsForContext("fs", "FS", tools);

            expect(result).toContain("⚠️ DESTRUCTIVE");
            expect(result).toContain("requires user confirmation");
        });

        it("formats multiple tools", () => {
            const tools = [
                makeTool({ name: "read_file" }),
                makeTool({ name: "write_file", destructive: true }),
            ];
            const result = formatToolsForContext("fs", "FS", tools);

            expect(result).toContain("read_file");
            expect(result).toContain("write_file");
        });
    });

    // ── formatInputSchema ───────────────────────────────

    describe("formatInputSchema()", () => {
        it("returns 'none' for empty schema", () => {
            expect(formatInputSchema({})).toBe("none");
        });

        it("formats properties with types and descriptions", () => {
            const schema = {
                type: "object",
                properties: {
                    path: { type: "string", description: "File path" },
                    encoding: { type: "string" },
                },
                required: ["path"],
            };
            const result = formatInputSchema(schema);
            expect(result).toContain("path: string (required)");
            expect(result).toContain("encoding: string (optional)");
            expect(result).toContain("File path");
        });

        it("handles schema without properties", () => {
            const schema = { type: "object" };
            const result = formatInputSchema(schema);
            expect(result).toContain("object"); // Falls back to JSON stringify
        });
    });

    // ── mergeToolContextWithSkills ───────────────────────

    describe("mergeToolContextWithSkills()", () => {
        it("returns empty string when both empty", () => {
            expect(mergeToolContextWithSkills([], [])).toBe("");
        });

        it("includes only skills when no MCP tools", () => {
            const result = mergeToolContextWithSkills(
                ["Skill A instructions", "Skill B instructions"],
                []
            );
            expect(result).toContain("## Loaded Skills");
            expect(result).toContain("Skill A instructions");
            expect(result).not.toContain("## Available MCP Tools");
        });

        it("includes only MCP tools when no skills", () => {
            const result = mergeToolContextWithSkills([], [
                "[MCP Server: FS] read_file, write_file",
            ]);
            expect(result).toContain("## Available MCP Tools");
            expect(result).not.toContain("## Loaded Skills");
        });

        it("includes both when both present", () => {
            const result = mergeToolContextWithSkills(
                ["Skill instructions"],
                ["MCP tool context"]
            );
            expect(result).toContain("## Loaded Skills");
            expect(result).toContain("## Available MCP Tools");
        });
    });
});
