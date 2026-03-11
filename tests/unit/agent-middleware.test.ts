import { describe, it, expect, beforeEach, vi } from "vitest";
import { setSkillRegistry, withContext } from "baseclaw-agent/src/agents/agent-middleware.js";
import { SkillRegistry } from "baseclaw-agent/src/skills/registry.js";
import { registerBuiltinSkills } from "baseclaw-agent/src/skills/builtin/index.js";
import { Command } from "@langchain/langgraph";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseClawStateType } from "baseclaw-agent/src/state.js";

/** Minimal state for testing */
function makeState(overrides?: Partial<BaseClawStateType>): BaseClawStateType {
    return {
        messages: [new HumanMessage("Hello")],
        currentAgent: "conversation",
        taskContext: "test task",
        activeSkills: [],
        ...overrides,
    } as BaseClawStateType;
}

describe("Agent Middleware", () => {
    // ── setSkillRegistry() ─────────────────────────────────

    describe("setSkillRegistry()", () => {
        it("accepts a SkillRegistry instance without throwing", () => {
            const registry = new SkillRegistry();
            expect(() => setSkillRegistry(registry)).not.toThrow();
        });

        it("accepts a populated registry", () => {
            const registry = new SkillRegistry();
            registerBuiltinSkills(registry);
            expect(() => setSkillRegistry(registry)).not.toThrow();
        });
    });

    // ── withContext() ──────────────────────────────────────

    describe("withContext()", () => {
        beforeEach(() => {
            // Provide a clean registry each time
            const registry = new SkillRegistry();
            registerBuiltinSkills(registry);
            setSkillRegistry(registry);
        });

        it("returns a function", () => {
            const mockAgent = vi.fn().mockResolvedValue(
                new Command({ goto: "conversation", update: { messages: [] } })
            );
            const wrapped = withContext(mockAgent, "conversation");
            expect(typeof wrapped).toBe("function");
        });

        it("calls the inner agent function", async () => {
            const mockAgent = vi.fn().mockResolvedValue(
                new Command({ goto: "conversation", update: { messages: [] } })
            );
            const wrapped = withContext(mockAgent, "conversation");
            const state = makeState();

            await wrapped(state);

            expect(mockAgent).toHaveBeenCalledTimes(1);
        });

        it("passes state to the inner agent function", async () => {
            const mockAgent = vi.fn().mockResolvedValue(
                new Command({ goto: "conversation", update: { messages: [] } })
            );
            const wrapped = withContext(mockAgent, "ideation");
            const state = makeState({ taskContext: "brainstorm ideas" });

            await wrapped(state);

            // First argument should be the state (or state-like)
            const call = mockAgent.mock.calls[0];
            expect(call[0]).toBe(state);
        });

        it("passes context messages as second argument", async () => {
            const mockAgent = vi.fn().mockResolvedValue(
                new Command({ goto: "conversation", update: { messages: [] } })
            );
            const wrapped = withContext(mockAgent, "conversation");
            const state = makeState();

            await wrapped(state);

            const contextMessages = mockAgent.mock.calls[0][1];
            expect(Array.isArray(contextMessages)).toBe(true);
        });

        it("returns a Command from the wrapped function", async () => {
            const expectedCommand = new Command({
                goto: "conversation",
                update: { messages: [new SystemMessage("Response")] },
            });
            const mockAgent = vi.fn().mockResolvedValue(expectedCommand);
            const wrapped = withContext(mockAgent, "conversation");

            const result = await wrapped(makeState());

            expect(result).toBeInstanceOf(Command);
        });

        it("handles empty taskContext gracefully", async () => {
            const mockAgent = vi.fn().mockResolvedValue(
                new Command({ goto: "conversation", update: { messages: [] } })
            );
            const wrapped = withContext(mockAgent, "conversation");
            const state = makeState({ taskContext: "" });

            // Should not throw
            await expect(wrapped(state)).resolves.toBeInstanceOf(Command);
        });

        it("handles empty messages array gracefully", async () => {
            const mockAgent = vi.fn().mockResolvedValue(
                new Command({ goto: "conversation", update: { messages: [] } })
            );
            const wrapped = withContext(mockAgent, "conversation");
            const state = makeState({ messages: [] });

            await expect(wrapped(state)).resolves.toBeInstanceOf(Command);
        });

        it("works with all agent types", async () => {
            const agentTypes = [
                "conversation",
                "ideation",
                "planning",
                "execution",
                "reviewer",
            ] as const;

            for (const agentType of agentTypes) {
                const mockAgent = vi.fn().mockResolvedValue(
                    new Command({ goto: "conversation", update: { messages: [] } })
                );
                const wrapped = withContext(mockAgent, agentType);
                await expect(wrapped(makeState())).resolves.toBeInstanceOf(Command);
            }
        });
    });
});
