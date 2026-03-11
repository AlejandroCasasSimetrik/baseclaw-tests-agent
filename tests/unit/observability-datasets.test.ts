import { describe, it, expect } from "vitest";
import {
    DATASET_CONFIGS,
    CONVERSATION_EXAMPLES,
    IDEATION_EXAMPLES,
    PLANNING_EXAMPLES,
    EXECUTION_EXAMPLES,
    REVIEWER_EXAMPLES,
    getDatasetConfigForAgent,
} from "baseclaw-agent/src/observability/datasets.js";

describe("Datasets (Level 4)", () => {
    // ── Dataset configs ─────────────────────────────────────

    it("defines datasets for all 5 agent types", () => {
        expect(DATASET_CONFIGS).toHaveLength(5);
        const agentTypes = DATASET_CONFIGS.map((d) => d.agentType);
        expect(agentTypes).toContain("conversation");
        expect(agentTypes).toContain("ideation");
        expect(agentTypes).toContain("planning");
        expect(agentTypes).toContain("execution");
        expect(agentTypes).toContain("reviewer");
    });

    it("each dataset has a name and description", () => {
        for (const config of DATASET_CONFIGS) {
            expect(config.name).toBeTruthy();
            expect(config.name).toMatch(/^baseclaw-/);
            expect(config.description).toBeTruthy();
        }
    });

    it("each dataset has at least 2 examples", () => {
        for (const config of DATASET_CONFIGS) {
            expect(config.examples.length).toBeGreaterThanOrEqual(2);
        }
    });

    // ── Synthetic examples structure ────────────────────────

    it("conversation examples have message inputs and route outputs", () => {
        for (const example of CONVERSATION_EXAMPLES) {
            expect(example.inputs).toHaveProperty("message");
            expect(example.outputs).toHaveProperty("route");
        }
    });

    it("ideation examples have taskContext inputs", () => {
        for (const example of IDEATION_EXAMPLES) {
            expect(example.inputs).toHaveProperty("taskContext");
        }
    });

    it("planning examples have taskContext inputs", () => {
        for (const example of PLANNING_EXAMPLES) {
            expect(example.inputs).toHaveProperty("taskContext");
        }
    });

    it("execution examples have taskContext inputs", () => {
        for (const example of EXECUTION_EXAMPLES) {
            expect(example.inputs).toHaveProperty("taskContext");
        }
    });

    it("reviewer examples have taskContext inputs", () => {
        for (const example of REVIEWER_EXAMPLES) {
            expect(example.inputs).toHaveProperty("taskContext");
        }
    });

    // ── Routing examples cover all routes ───────────────────

    it("conversation examples cover all routing targets", () => {
        const routes = CONVERSATION_EXAMPLES.map((e) => e.outputs.route);
        expect(routes).toContain("conversation");
        expect(routes).toContain("ideation");
        expect(routes).toContain("planning");
        expect(routes).toContain("execution");
        expect(routes).toContain("review");
    });

    // ── getDatasetConfigForAgent ─────────────────────────────

    it("returns correct config for agent type", () => {
        const config = getDatasetConfigForAgent("conversation");
        expect(config).toBeDefined();
        expect(config!.agentType).toBe("conversation");
    });

    it("returns undefined for unknown agent type", () => {
        const config = getDatasetConfigForAgent("unknown" as any);
        expect(config).toBeUndefined();
    });
});
