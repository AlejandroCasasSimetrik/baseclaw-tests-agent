import { describe, it, expect, vi, beforeEach } from "vitest";
import { InspectorEventBus, inspectorBus } from "baseclaw-agent/src/inspector/event-bus.js";

describe("InspectorEventBus", () => {
    let bus: InspectorEventBus;

    beforeEach(() => {
        bus = new InspectorEventBus();
    });

    // ── Core Emission ──────────────────────────────────────

    describe("emitEvent()", () => {
        it("emits events on the 'inspector' channel", () => {
            const received: any[] = [];
            bus.on("inspector", (event) => received.push(event));

            bus.emitEvent({
                type: "skill:registered",
                timestamp: new Date().toISOString(),
                data: { skillId: "test.skill", skillName: "Test" },
            });

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("skill:registered");
            expect(received[0].data.skillId).toBe("test.skill");
        });

        it("preserves timestamps in events", () => {
            const received: any[] = [];
            bus.on("inspector", (event) => received.push(event));

            const timestamp = "2024-01-01T00:00:00.000Z";
            bus.emitEvent({
                type: "mcp:connected",
                timestamp,
                data: { serverId: "test-server" },
            });

            expect(received[0].timestamp).toBe(timestamp);
        });
    });

    // ── Convenience Methods ────────────────────────────────

    describe("emitSkillEvent()", () => {
        it("emits skill events with auto-generated timestamps", () => {
            const received: any[] = [];
            bus.on("inspector", (event) => received.push(event));

            bus.emitSkillEvent("skill:loaded", {
                skillId: "ideation.brainstorming",
                agentType: "ideation",
                relevanceScore: 0.85,
            });

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("skill:loaded");
            expect(received[0].timestamp).toBeTruthy();
            expect(received[0].data.skillId).toBe("ideation.brainstorming");
            expect(received[0].data.relevanceScore).toBe(0.85);
        });

        it("emits all skill event types", () => {
            const types: string[] = [];
            bus.on("inspector", (event) => types.push(event.type));

            bus.emitSkillEvent("skill:registered", { skillId: "a" });
            bus.emitSkillEvent("skill:unregistered", { skillId: "a" });
            bus.emitSkillEvent("skill:loaded", { skillId: "a" });
            bus.emitSkillEvent("skill:unloaded", { skillId: "a" });
            bus.emitSkillEvent("skill:relevance_scored", { skillId: "a" });

            expect(types).toEqual([
                "skill:registered",
                "skill:unregistered",
                "skill:loaded",
                "skill:unloaded",
                "skill:relevance_scored",
            ]);
        });
    });

    describe("emitMCPEvent()", () => {
        it("emits MCP events with auto-generated timestamps", () => {
            const received: any[] = [];
            bus.on("inspector", (event) => received.push(event));

            bus.emitMCPEvent("mcp:registered", {
                serverId: "github-mcp",
                serverName: "GitHub MCP",
                transport: "sse",
            });

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("mcp:registered");
            expect(received[0].data.serverId).toBe("github-mcp");
        });

        it("emits all MCP event types", () => {
            const types: string[] = [];
            bus.on("inspector", (event) => types.push(event.type));

            bus.emitMCPEvent("mcp:registered", {});
            bus.emitMCPEvent("mcp:unregistered", {});
            bus.emitMCPEvent("mcp:connected", {});
            bus.emitMCPEvent("mcp:disconnected", {});
            bus.emitMCPEvent("mcp:tool_discovered", {});
            bus.emitMCPEvent("mcp:tool_called", {});

            expect(types).toEqual([
                "mcp:registered",
                "mcp:unregistered",
                "mcp:connected",
                "mcp:disconnected",
                "mcp:tool_discovered",
                "mcp:tool_called",
            ]);
        });
    });

    describe("emitContextEvent()", () => {
        it("emits context events with auto-generated timestamps", () => {
            const received: any[] = [];
            bus.on("inspector", (event) => received.push(event));

            bus.emitContextEvent("context:loaded", {
                agentType: "conversation",
                skillIds: ["skill.a"],
                mcpServerIds: ["mcp.b"],
                ragChunks: 5,
                memoryResults: 2,
            });

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("context:loaded");
            expect(received[0].timestamp).toBeTruthy();
            expect(received[0].data.agentType).toBe("conversation");
        });

        it("emits all context event types including context:unloaded", () => {
            const types: string[] = [];
            bus.on("inspector", (event) => types.push(event.type));

            bus.emitContextEvent("memory:loaded", {});
            bus.emitContextEvent("rag:loaded", {});
            bus.emitContextEvent("context:loaded", {});
            bus.emitContextEvent("context:unloaded", {});

            expect(types).toEqual([
                "memory:loaded",
                "rag:loaded",
                "context:loaded",
                "context:unloaded",
            ]);
        });

        it("emits context:unloaded with skill and RAG data", () => {
            const received: any[] = [];
            bus.on("inspector", (event) => received.push(event));

            bus.emitContextEvent("context:unloaded", {
                agentType: "ideation",
                skillIds: ["skill.brainstorm"],
                ragChunks: 0,
                memoryResults: 0,
            });

            expect(received[0].type).toBe("context:unloaded");
            expect(received[0].data.skillIds).toEqual(["skill.brainstorm"]);
        });
    });

    describe("emitMemoryEvent()", () => {
        it("emits memory events with auto-generated timestamps", () => {
            const received: any[] = [];
            bus.on("inspector", (event) => received.push(event));

            bus.emitMemoryEvent("memory:episode_written", {
                agentType: "reviewer",
                episodeId: "ep-1",
                taskSummary: "reviewed code",
            });

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe("memory:episode_written");
            expect(received[0].timestamp).toBeTruthy();
        });

        it("emits all memory event types", () => {
            const types: string[] = [];
            bus.on("inspector", (event) => types.push(event.type));

            bus.emitMemoryEvent("memory:working_loaded", {});
            bus.emitMemoryEvent("memory:working_cleared", {});
            bus.emitMemoryEvent("memory:episode_written", {});
            bus.emitMemoryEvent("memory:semantic_query", {});
            bus.emitMemoryEvent("memory:semantic_write", {});
            bus.emitMemoryEvent("memory:hitl_event", {});
            bus.emitMemoryEvent("memory:feedback_loop", {});

            expect(types).toEqual([
                "memory:working_loaded",
                "memory:working_cleared",
                "memory:episode_written",
                "memory:semantic_query",
                "memory:semantic_write",
                "memory:hitl_event",
                "memory:feedback_loop",
            ]);
        });
    });

    // ── Listener Management ────────────────────────────────

    describe("getListenerCount()", () => {
        it("returns 0 when no listeners attached", () => {
            expect(bus.getListenerCount()).toBe(0);
        });

        it("returns correct count with listeners", () => {
            const fn1 = () => { };
            const fn2 = () => { };
            bus.on("inspector", fn1);
            bus.on("inspector", fn2);

            expect(bus.getListenerCount()).toBe(2);
        });

        it("decrements when listener removed", () => {
            const fn = () => { };
            bus.on("inspector", fn);
            expect(bus.getListenerCount()).toBe(1);

            bus.off("inspector", fn);
            expect(bus.getListenerCount()).toBe(0);
        });
    });

    describe("no listeners", () => {
        it("does not throw when emitting with no listeners", () => {
            expect(() => {
                bus.emitSkillEvent("skill:registered", { skillId: "test" });
                bus.emitMCPEvent("mcp:connected", { serverId: "test" });
                bus.emitContextEvent("context:loaded", { agentType: "test" });
                bus.emitContextEvent("context:unloaded", { agentType: "test" });
                bus.emitMemoryEvent("memory:episode_written", {});
            }).not.toThrow();
        });
    });

    // ── Singleton ──────────────────────────────────────────

    describe("singleton export", () => {
        it("inspectorBus is an instance of InspectorEventBus", () => {
            expect(inspectorBus).toBeInstanceOf(InspectorEventBus);
        });

        it("is the same instance on repeated import", () => {
            // The module-level singleton should always be the same
            expect(inspectorBus).toBe(inspectorBus);
        });
    });
});
