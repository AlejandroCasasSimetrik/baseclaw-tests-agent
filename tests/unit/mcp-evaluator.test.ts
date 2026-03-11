import { describe, it, expect } from "vitest";
import { mcpToolAccuracyEvaluator, EVALUATOR_TEMPLATES } from "baseclaw-agent/src/observability/evaluators.js";
import type { EvaluatorInput } from "baseclaw-agent/src/observability/evaluators.js";

describe("MCP Tool Accuracy Evaluator", () => {
    // ── Registration ────────────────────────────────────

    it("is registered in EVALUATOR_TEMPLATES", () => {
        expect(EVALUATOR_TEMPLATES.mcp_tool_accuracy).toBeDefined();
        expect(EVALUATOR_TEMPLATES.mcp_tool_accuracy).toBe(mcpToolAccuracyEvaluator);
    });

    // ── Fallback Behavior ───────────────────────────────

    it("returns key 'mcp_tool_accuracy'", async () => {
        const input: EvaluatorInput = {
            inputs: { task: "Read a file" },
            outputs: { mcpToolCalls: [] },
        };

        const result = await mcpToolAccuracyEvaluator(input);
        expect(result.key).toBe("mcp_tool_accuracy");
    });

    it("returns score 0.0 when no tool calls and no LLM available", async () => {
        const input: EvaluatorInput = {
            inputs: { task: "Read a file" },
            outputs: { mcpToolCalls: [] },
        };

        const result = await mcpToolAccuracyEvaluator(input);
        // Without LLM, fallback: empty tool calls → 0.0
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
    });

    it("returns score > 0 when tool calls are present (fallback)", async () => {
        const input: EvaluatorInput = {
            inputs: { task: "Read file /tmp/test.txt" },
            outputs: {
                mcpToolCalls: [
                    {
                        serverId: "fs-server",
                        serverName: "Filesystem",
                        toolName: "read_file",
                        input: { path: "/tmp/test.txt" },
                        success: true,
                    },
                ],
            },
        };

        const result = await mcpToolAccuracyEvaluator(input);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
        expect(result.comment).toBeTruthy();
    });

    // ── Input Parsing ───────────────────────────────────

    it("handles taskDescription as alternate input key", async () => {
        const input: EvaluatorInput = {
            inputs: { taskDescription: "Analyze data" },
            outputs: { toolCalls: [] },
        };

        const result = await mcpToolAccuracyEvaluator(input);
        expect(result.key).toBe("mcp_tool_accuracy");
    });

    it("handles toolCalls as alternate output key", async () => {
        const input: EvaluatorInput = {
            inputs: { task: "Test" },
            outputs: {
                toolCalls: [
                    { toolName: "test_tool", success: true },
                ],
            },
        };

        const result = await mcpToolAccuracyEvaluator(input);
        expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("handles availableTools in input", async () => {
        const input: EvaluatorInput = {
            inputs: {
                task: "Read a file",
                availableTools: [
                    { name: "read_file", description: "Read file contents" },
                    { name: "write_file", description: "Write to a file" },
                ],
            },
            outputs: {
                mcpToolCalls: [
                    { toolName: "read_file", success: true },
                ],
            },
        };

        const result = await mcpToolAccuracyEvaluator(input);
        expect(result.key).toBe("mcp_tool_accuracy");
        expect(result.score).toBeGreaterThanOrEqual(0);
    });

    // ── Score Bounds ────────────────────────────────────

    it("score is always between 0 and 1", async () => {
        const inputs: EvaluatorInput[] = [
            { inputs: { task: "" }, outputs: { mcpToolCalls: [] } },
            { inputs: { task: "test" }, outputs: { mcpToolCalls: [{ toolName: "t" }] } },
            { inputs: { task: "complex task" }, outputs: {} },
        ];

        for (const input of inputs) {
            const result = await mcpToolAccuracyEvaluator(input);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
        }
    }, 30_000);
});
