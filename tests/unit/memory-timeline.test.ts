import { describe, it, expect, beforeEach } from "vitest";
import {
    recordTimelineEvent,
    getTimelineEvents,
    clearTimeline,
    getTimelineCount,
} from "baseclaw-agent/src/inspector/memory-timeline.js";
import type { MemoryLayer, TimelineEntry } from "baseclaw-agent/src/inspector/memory-timeline.js";

describe("Memory Timeline", () => {
    beforeEach(() => {
        clearTimeline();
    });

    // ── recordTimelineEvent ────────────────────────────────

    describe("recordTimelineEvent()", () => {
        it("records an event and returns a TimelineEntry", () => {
            const entry = recordTimelineEvent(
                "working",
                "conversation",
                "memory:working_loaded",
                "Loaded 3 items",
                { itemCount: 3 }
            );

            expect(entry.id).toMatch(/^mem-\d+$/);
            expect(entry.layer).toBe("working");
            expect(entry.agentType).toBe("conversation");
            expect(entry.type).toBe("memory:working_loaded");
            expect(entry.summary).toBe("Loaded 3 items");
            expect(entry.metadata).toEqual({ itemCount: 3 });
            expect(entry.timestamp).toBeTruthy();
        });

        it("generates unique IDs for consecutive events", () => {
            const e1 = recordTimelineEvent("working", "ideation", "test1", "a");
            const e2 = recordTimelineEvent("episodic", "planning", "test2", "b");
            expect(e1.id).not.toBe(e2.id);
        });

        it("increments count", () => {
            expect(getTimelineCount()).toBe(0);
            recordTimelineEvent("working", "conversation", "t", "s");
            expect(getTimelineCount()).toBe(1);
            recordTimelineEvent("episodic", "reviewer", "t", "s");
            expect(getTimelineCount()).toBe(2);
        });

        it("defaults metadata to empty object", () => {
            const entry = recordTimelineEvent("semantic", "execution", "t", "s");
            expect(entry.metadata).toEqual({});
        });

        it("accepts all valid MemoryLayer values", () => {
            const layers: MemoryLayer[] = ["working", "episodic", "semantic"];
            for (const layer of layers) {
                const entry = recordTimelineEvent(layer, "conversation", "t", "s");
                expect(entry.layer).toBe(layer);
            }
        });
    });

    // ── getTimelineEvents ──────────────────────────────────

    describe("getTimelineEvents()", () => {
        it("returns all events when no filters", () => {
            recordTimelineEvent("working", "conversation", "t1", "s1");
            recordTimelineEvent("episodic", "ideation", "t2", "s2");
            recordTimelineEvent("semantic", "planning", "t3", "s3");

            const events = getTimelineEvents();
            expect(events).toHaveLength(3);
        });

        it("filters by layer", () => {
            recordTimelineEvent("working", "conversation", "t1", "s1");
            recordTimelineEvent("episodic", "ideation", "t2", "s2");
            recordTimelineEvent("working", "planning", "t3", "s3");

            const events = getTimelineEvents({ layers: ["working"] });
            expect(events).toHaveLength(2);
            expect(events.every(e => e.layer === "working")).toBe(true);
        });

        it("filters by agentType", () => {
            recordTimelineEvent("working", "conversation", "t1", "s1");
            recordTimelineEvent("episodic", "ideation", "t2", "s2");
            recordTimelineEvent("semantic", "conversation", "t3", "s3");

            const events = getTimelineEvents({ agentType: "conversation" });
            expect(events).toHaveLength(2);
            expect(events.every(e => e.agentType === "conversation")).toBe(true);
        });

        it("respects limit", () => {
            for (let i = 0; i < 10; i++) {
                recordTimelineEvent("working", "conversation", `t${i}`, `s${i}`);
            }

            const events = getTimelineEvents({ limit: 5 });
            expect(events).toHaveLength(5);
        });

        it("returns most recent events when limit is applied", () => {
            for (let i = 0; i < 10; i++) {
                recordTimelineEvent("working", "conversation", `type-${i}`, `summary-${i}`);
            }

            const events = getTimelineEvents({ limit: 3 });
            expect(events).toHaveLength(3);
            // Should be the last 3
            expect(events[2].type).toBe("type-9");
        });

        it("returns empty array when no events match", () => {
            recordTimelineEvent("working", "conversation", "t", "s");
            const events = getTimelineEvents({ agentType: "nonexistent" });
            expect(events).toHaveLength(0);
        });

        it("combines multiple filters", () => {
            recordTimelineEvent("working", "conversation", "t1", "s1");
            recordTimelineEvent("episodic", "conversation", "t2", "s2");
            recordTimelineEvent("working", "ideation", "t3", "s3");

            const events = getTimelineEvents({
                layers: ["working"],
                agentType: "conversation",
            });
            expect(events).toHaveLength(1);
            expect(events[0].layer).toBe("working");
            expect(events[0].agentType).toBe("conversation");
        });
    });

    // ── clearTimeline ──────────────────────────────────────

    describe("clearTimeline()", () => {
        it("removes all events", () => {
            recordTimelineEvent("working", "conversation", "t", "s");
            recordTimelineEvent("episodic", "ideation", "t", "s");
            expect(getTimelineCount()).toBe(2);

            clearTimeline();
            expect(getTimelineCount()).toBe(0);
            expect(getTimelineEvents()).toHaveLength(0);
        });

        it("resets ID counter", () => {
            recordTimelineEvent("working", "conversation", "t", "s");
            clearTimeline();
            const entry = recordTimelineEvent("working", "conversation", "t", "s");
            expect(entry.id).toBe("mem-1");
        });
    });

    // ── Ring Buffer ────────────────────────────────────────

    describe("ring buffer behavior", () => {
        it("enforces maximum entry limit (500)", () => {
            for (let i = 0; i < 510; i++) {
                recordTimelineEvent("working", "conversation", `t-${i}`, `s-${i}`);
            }

            expect(getTimelineCount()).toBe(500);
        });

        it("drops oldest entries when buffer overflows", () => {
            clearTimeline(); // Extra guarantee of clean state
            // Insert 510 unique entries, each with a marker in metadata
            for (let i = 0; i < 510; i++) {
                recordTimelineEvent("working", "conversation", `overflow-${i}`, `s-${i}`, { index: i });
            }

            const events = getTimelineEvents({ limit: 500 });
            expect(events).toHaveLength(500);

            // The oldest 10 entries (index 0-9) should have been dropped
            const firstIndex = (events[0].metadata as any).index;
            const lastIndex = (events[events.length - 1].metadata as any).index;
            expect(firstIndex).toBe(10);
            expect(lastIndex).toBe(509);
        });
    });
});
