import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { conversationAgent } from "baseclaw-agent/src/agents/conversation.js";
import { ideationAgent } from "baseclaw-agent/src/agents/ideation.js";
import { planningAgent } from "baseclaw-agent/src/agents/planning.js";
import { executionAgent } from "baseclaw-agent/src/agents/execution.js";
import { reviewerAgent } from "baseclaw-agent/src/agents/reviewer.js";
import type { BaseClawStateType } from "baseclaw-agent/src/state.js";

/** Helper to create a minimal state for testing */
function makeState(
    overrides: Partial<BaseClawStateType> = {}
): BaseClawStateType {
    return {
        messages: [new HumanMessage("test input")],
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

describe("Agent Iteration Safety", () => {
    it("conversation agent returns Command on iteration limit", async () => {
        const state = makeState({ iterationCount: 25, maxIterations: 25 });
        const result = await conversationAgent(state);
        expect(result).toBeInstanceOf(Command);
    });

    it("ideation agent returns Command on iteration limit", async () => {
        const state = makeState({ iterationCount: 25, maxIterations: 25 });
        const result = await ideationAgent(state);
        expect(result).toBeInstanceOf(Command);
    });

    it("planning agent returns Command on iteration limit", async () => {
        const state = makeState({ iterationCount: 25, maxIterations: 25 });
        const result = await planningAgent(state);
        expect(result).toBeInstanceOf(Command);
    });

    it("execution agent returns Command on iteration limit", async () => {
        const state = makeState({ iterationCount: 25, maxIterations: 25 });
        const result = await executionAgent(state);
        expect(result).toBeInstanceOf(Command);
    });

    it("reviewer agent returns Command on iteration limit", async () => {
        const state = makeState({ iterationCount: 25, maxIterations: 25 });
        const result = await reviewerAgent(state);
        expect(result).toBeInstanceOf(Command);
    });
});

describe("Agent Return Types", () => {
    it("all agents return Command instances on safety halt", async () => {
        const agents = [
            conversationAgent,
            ideationAgent,
            planningAgent,
            executionAgent,
            reviewerAgent,
        ];

        for (const agentFn of agents) {
            const state = makeState({ iterationCount: 999, maxIterations: 25 });
            const result = await agentFn(state);
            expect(result).toBeInstanceOf(Command);
        }
    }, 30_000);
});

describe("Agent Isolation", () => {
    it("conversation agent doesn't mutate input state", async () => {
        const state = makeState({ iterationCount: 25, maxIterations: 25 });
        const originalCount = state.iterationCount;
        await conversationAgent(state);
        expect(state.iterationCount).toBe(originalCount);
    });

    it("ideation agent doesn't mutate input state", async () => {
        const state = makeState({ iterationCount: 25, maxIterations: 25 });
        const originalCount = state.iterationCount;
        await ideationAgent(state);
        expect(state.iterationCount).toBe(originalCount);
    });
});
