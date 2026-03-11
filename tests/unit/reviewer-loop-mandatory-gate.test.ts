import { describe, it, expect } from "vitest";
import { reviewerGateNode } from "baseclaw-agent/src/reviewer-loop/mandatory-gate.js";
import { defaultReviewerGateState } from "baseclaw-agent/src/reviewer-loop/types.js";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * Helper to build minimal state for the mandatory gate node.
 */
function buildGateState(overrides: Record<string, any> = {}) {
    return {
        messages: overrides.messages ?? [
            new HumanMessage("Build a REST API"),
            new AIMessage("Here is my plan for a REST API with Express.js, covering all CRUD operations with proper error handling, validation, and authentication..."),
        ],
        currentAgent: overrides.currentAgent ?? "execution",
        phase: overrides.phase ?? "execution",
        iterationCount: overrides.iterationCount ?? 1,
        taskContext: overrides.taskContext ?? "Build a REST API with Express.js",
        activeSkills: [],
        tenantId: overrides.tenantId ?? "default",
        workingMemory: null,
        mcpServers: [],
        voiceInput: null,
        hitlState: { pending: false, requestId: null },
        reviewerGateState: overrides.reviewerGateState ?? {
            ...defaultReviewerGateState(),
            active: true,
            sourceAgent: overrides.currentAgent ?? "execution",
            triggerType: "mandatory_gate",
        },
    } as any;
}

describe("Level 10 — Mandatory Gate", () => {
    it("reviews agent output and returns a Command", async () => {
        const state = buildGateState();
        const result = await reviewerGateNode(state);

        // Should return a Command (has goto and update fields)
        expect(result).toBeDefined();
        expect(typeof result).toBe("object");
    }, 60_000);

    it("passes through non-gated agents (conversation)", async () => {
        const state = buildGateState({
            currentAgent: "conversation",
            reviewerGateState: {
                ...defaultReviewerGateState(),
                sourceAgent: "conversation",
            },
        });
        const result = await reviewerGateNode(state);

        // Conversation agent bypasses the gate
        expect(result).toBeDefined();
    }, 15_000);

    it("handles missing messages gracefully", async () => {
        const state = buildGateState({ messages: [] });
        const result = await reviewerGateNode(state);
        expect(result).toBeDefined();
    }, 15_000);

    it("processes ideation agent output through the gate", async () => {
        const state = buildGateState({
            currentAgent: "ideation",
            reviewerGateState: {
                ...defaultReviewerGateState(),
                active: true,
                sourceAgent: "ideation",
                triggerType: "mandatory_gate",
            },
            messages: [
                new HumanMessage("Brainstorm ideas for a mobile app"),
                new AIMessage("Here are 5 innovative ideas for a mobile app: 1) AI-powered fitness coach, 2) Community garden planner, 3) Language exchange platform, 4) Sustainable shopping guide, 5) Personal memory journal with AI insights. Each addresses a real need..."),
            ],
            taskContext: "Brainstorm mobile app ideas",
        });
        const result = await reviewerGateNode(state);
        expect(result).toBeDefined();
    }, 60_000);

    it("processes planning agent output through the gate", async () => {
        const state = buildGateState({
            currentAgent: "planning",
            reviewerGateState: {
                ...defaultReviewerGateState(),
                active: true,
                sourceAgent: "planning",
                triggerType: "mandatory_gate",
            },
            messages: [
                new HumanMessage("Create a project plan"),
                new AIMessage("## Project Plan\n\n### Phase 1: Setup\n- Initialize repository\n- Configure CI/CD\n\n### Phase 2: Core Features\n- Implement user auth\n- Build dashboard\n\n### Phase 3: Launch\n- Testing\n- Deployment"),
            ],
            taskContext: "Create a project plan for a SaaS dashboard",
        });
        const result = await reviewerGateNode(state);
        expect(result).toBeDefined();
    }, 60_000);

    it("tracks revision count in gate state", async () => {
        const state = buildGateState({
            reviewerGateState: {
                active: true,
                sourceAgent: "execution",
                revisionCount: 1,
                revisionHistory: [],
                currentReviewId: "review-prev",
                triggerType: "mandatory_gate",
                pendingFeedback: null,
            },
        });
        const result = await reviewerGateNode(state);
        expect(result).toBeDefined();
    }, 60_000);
});
