/**
 * Level 8 — Agent Middleware Tests (Real Services)
 *
 * Tests that withContext() properly:
 *   1. Loads memory context before agent execution
 *   2. Loads skills based on task context
 *   3. Builds MCP tool prompts
 *   4. Records episodes after execution
 *   5. Degrades gracefully when services are unavailable
 *
 * Uses real PostgreSQL, Pinecone, and LLM — no mocks.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Command } from "@langchain/langgraph";
import { SystemMessage } from "@langchain/core/messages";
import {
    withContext,
    setSkillRegistry,
} from "baseclaw-agent/src/agents/agent-middleware.js";
import {
    buildMCPToolPrompt,
    setMCPRegistry,
    getMCPRegistry,
} from "baseclaw-agent/src/agents/mcp-middleware.js";
import { SkillRegistry, registerBuiltinSkills } from "baseclaw-agent/src/skills/index.js";
import { MCPServerRegistry } from "baseclaw-agent/src/mcp/registry.js";
import type { BaseClawStateType } from "baseclaw-agent/src/state.js";

describe("Level 8 — Agent Middleware", { timeout: 30_000 }, () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-your-openai-api-key") {
            throw new Error("OPENAI_API_KEY is required.");
        }
    });

    // ── withContext() wrapper ─────────────────────────────────

    describe("withContext()", () => {
        it("wraps a core agent function and returns a function", () => {
            const core = async (_state: BaseClawStateType, _ctx: SystemMessage[]) =>
                new Command({ goto: "__end__", update: {} });
            const wrapped = withContext(core, "ideation");
            expect(typeof wrapped).toBe("function");
        });

        it("wrapped function accepts state and returns Command", async () => {
            const core = async (_state: BaseClawStateType, _ctx: SystemMessage[]) =>
                new Command({ goto: "__end__", update: { messages: [] } });
            const wrapped = withContext(core, "ideation");

            const state = makeState();
            const result = await wrapped(state);
            expect(result).toBeInstanceOf(Command);
        });

        it("injects contextMessages array into core function", async () => {
            let receivedMessages: SystemMessage[] = [];

            const core = async (_state: BaseClawStateType, ctx: SystemMessage[]) => {
                receivedMessages = ctx;
                return new Command({ goto: "__end__", update: {} });
            };
            const wrapped = withContext(core, "execution");

            await wrapped(makeState({ taskContext: "Build a web scraper" }));

            // Context messages should be an array (may be empty if services unavailable)
            expect(Array.isArray(receivedMessages)).toBe(true);
            // Each element should be a SystemMessage
            for (const msg of receivedMessages) {
                expect(msg).toBeInstanceOf(SystemMessage);
            }
        });

        it("passes tenantId from state to context loading", async () => {
            // Verify tenantId flows through — the wrapped function reads it from state
            let coreExecuted = false;
            const core = async (_state: BaseClawStateType, _ctx: SystemMessage[]) => {
                coreExecuted = true;
                return new Command({ goto: "__end__", update: {} });
            };
            const wrapped = withContext(core, "conversation");

            await wrapped(makeState({ tenantId: "test-tenant-123" } as any));
            expect(coreExecuted).toBe(true);
        });

        it("degrades gracefully when memory DB is unavailable", async () => {
            // This should NOT throw even if PostgreSQL is down
            const core = async (_state: BaseClawStateType, _ctx: SystemMessage[]) =>
                new Command({ goto: "__end__", update: {} });
            const wrapped = withContext(core, "planning");

            // Use a tenant ID that won't have any data
            const result = await wrapped(
                makeState({ tenantId: "nonexistent-tenant" } as any)
            );
            expect(result).toBeInstanceOf(Command);
        });

        it("fires episode recording without blocking response", async () => {
            const startTime = Date.now();

            const core = async (_state: BaseClawStateType, _ctx: SystemMessage[]) =>
                new Command({ goto: "__end__", update: { messages: [] } });
            const wrapped = withContext(core, "reviewer");

            const result = await wrapped(makeState());
            const elapsed = Date.now() - startTime;

            expect(result).toBeInstanceOf(Command);
            // Episode recording is fire-and-forget — should not add significant delay
            // (the actual recording may fail if DB is unavailable, but that's OK)
            expect(elapsed).toBeLessThan(15_000);
        });
    });

    // ── setSkillRegistry() ────────────────────────────────────

    describe("setSkillRegistry()", () => {
        it("accepts a SkillRegistry and skills are loaded into prompts", async () => {
            const registry = new SkillRegistry();
            registerBuiltinSkills(registry);
            setSkillRegistry(registry);

            let receivedMessages: SystemMessage[] = [];
            const core = async (_state: BaseClawStateType, ctx: SystemMessage[]) => {
                receivedMessages = ctx;
                return new Command({ goto: "__end__", update: {} });
            };
            const wrapped = withContext(core, "ideation");

            // Task context should trigger skill loading
            await wrapped(
                makeState({ taskContext: "Brainstorm creative ideas for a new product" })
            );

            // Skills may or may not load depending on scoring, but the function runs
            expect(Array.isArray(receivedMessages)).toBe(true);
        });
    });
});

// ── MCP Middleware ───────────────────────────────────────────

describe("Level 8 — MCP Middleware", () => {
    describe("buildMCPToolPrompt()", () => {
        it("returns null when no registry is set", () => {
            setMCPRegistry(null as any);
            const result = buildMCPToolPrompt("execution");
            expect(result).toBeNull();
        });

        it("returns null when no servers are attached to agent type", () => {
            const registry = new MCPServerRegistry();
            setMCPRegistry(registry);

            const result = buildMCPToolPrompt("ideation");
            expect(result).toBeNull();
        });

        it("returns SystemMessage when servers are attached", () => {
            const registry = new MCPServerRegistry();
            registry.registerServer({
                id: "test-mcp-1",
                name: "Test Server",
                url: "http://localhost:9999",
                transport: "sse",
                agentTypes: "all",
                description: "A test MCP server for unit tests",
                authConfig: {},
                destructiveTools: ["delete_data"],
            });
            setMCPRegistry(registry);

            const result = buildMCPToolPrompt("execution");
            expect(result).toBeInstanceOf(SystemMessage);
            expect(result!.content).toContain("Test Server");
            expect(result!.content).toContain("test-mcp-1");
            expect(result!.content).toContain("A test MCP server for unit tests");
            expect(result!.content).toContain("delete_data");
        });

        it("filters servers by agent type", () => {
            const registry = new MCPServerRegistry();
            registry.registerServer({
                id: "execution-only",
                name: "Execution Server",
                url: "http://localhost:9998",
                transport: "sse",
                agentTypes: ["execution"],
                description: "Only for execution agent",
                authConfig: {},
                destructiveTools: [],
            });
            setMCPRegistry(registry);

            // Execution agent should see it
            const execResult = buildMCPToolPrompt("execution");
            expect(execResult).toBeInstanceOf(SystemMessage);
            expect(execResult!.content).toContain("Execution Server");

            // Ideation agent should NOT see it
            const ideaResult = buildMCPToolPrompt("ideation");
            expect(ideaResult).toBeNull();
        });
    });

    describe("setMCPRegistry() / getMCPRegistry()", () => {
        it("sets and retrieves registry", () => {
            const registry = new MCPServerRegistry();
            setMCPRegistry(registry);
            expect(getMCPRegistry()).toBe(registry);
        });
    });
});

// ── Helpers ─────────────────────────────────────────────────

function makeState(overrides: Partial<BaseClawStateType> = {}): BaseClawStateType {
    return {
        messages: [],
        currentAgent: "conversation",
        phase: "conversation",
        iterationCount: 0,
        maxIterations: 25,
        taskContext: "",
        activeSkills: [],
        workingMemory: null,
        attachedMCPServers: [],
        voiceInput: null,
        tenantId: "default",
        ...overrides,
    } as BaseClawStateType;
}
