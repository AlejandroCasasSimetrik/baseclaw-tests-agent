import { describe, it, expect } from "vitest";
import { createTraceMetadata } from "baseclaw-agent/src/observability/trace-metadata.js";

describe("Trace Metadata (Level 4)", () => {
    // ── createTraceMetadata ─────────────────────────────────

    it("creates metadata with all required fields", () => {
        const metadata = createTraceMetadata({
            agentType: "conversation",
            taskId: "task-123",
            phase: "ideation",
            skillsLoaded: ["skill-a", "skill-b"],
            tenantId: "tenant-456",
        });

        expect(metadata.agent_type).toBe("conversation");
        expect(metadata.task_id).toBe("task-123");
        expect(metadata.phase).toBe("ideation");
        expect(metadata.skills_loaded).toEqual(["skill-a", "skill-b"]);
        expect(metadata.tenant_id).toBe("tenant-456");
    });

    it("defaults skills_loaded to empty array", () => {
        const metadata = createTraceMetadata({
            agentType: "ideation",
            taskId: "task-789",
            phase: "execution",
        });

        expect(metadata.skills_loaded).toEqual([]);
    });

    it("defaults tenant_id to 'default'", () => {
        const metadata = createTraceMetadata({
            agentType: "planning",
            taskId: "task-abc",
            phase: "planning",
        });

        expect(metadata.tenant_id).toBe("default");
    });

    it("includes all 5 required metadata fields", () => {
        const metadata = createTraceMetadata({
            agentType: "execution",
            taskId: "t1",
            phase: "execution",
        });

        const keys = Object.keys(metadata);
        expect(keys).toContain("agent_type");
        expect(keys).toContain("task_id");
        expect(keys).toContain("phase");
        expect(keys).toContain("skills_loaded");
        expect(keys).toContain("tenant_id");
        expect(keys).toHaveLength(5);
    });

    // ── Sub-span helpers exist as functions ──────────────────

    it("traceSkillScoring is a callable function", async () => {
        const { traceSkillScoring } = await import(
            "baseclaw-agent/src/observability/trace-metadata.js"
        );
        expect(typeof traceSkillScoring).toBe("function");
    });

    it("traceMemoryRead is a callable function", async () => {
        const { traceMemoryRead } = await import(
            "baseclaw-agent/src/observability/trace-metadata.js"
        );
        expect(typeof traceMemoryRead).toBe("function");
    });

    it("traceMemoryWrite is a callable function", async () => {
        const { traceMemoryWrite } = await import(
            "baseclaw-agent/src/observability/trace-metadata.js"
        );
        expect(typeof traceMemoryWrite).toBe("function");
    });

    it("traceInterAgentMessage is a callable function", async () => {
        const { traceInterAgentMessage } = await import(
            "baseclaw-agent/src/observability/trace-metadata.js"
        );
        expect(typeof traceInterAgentMessage).toBe("function");
    });

    // ── Level 9 — Heartbeat & HITL trace helpers ────────────

    it("traceHeartbeat is a callable function", async () => {
        const { traceHeartbeat } = await import(
            "baseclaw-agent/src/observability/trace-metadata.js"
        );
        expect(typeof traceHeartbeat).toBe("function");
    });

    it("traceHITLTrigger is a callable function", async () => {
        const { traceHITLTrigger } = await import(
            "baseclaw-agent/src/observability/trace-metadata.js"
        );
        expect(typeof traceHITLTrigger).toBe("function");
    });

    it("traceHITLResume is a callable function", async () => {
        const { traceHITLResume } = await import(
            "baseclaw-agent/src/observability/trace-metadata.js"
        );
        expect(typeof traceHITLResume).toBe("function");
    });
});
