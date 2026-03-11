import { describe, it, expect } from "vitest";
import { BaseClawState } from "baseclaw-agent/src/state.js";

describe("BaseClawState", () => {
    describe("schema completeness", () => {
        it("has all 14 required fields", () => {
            const fields = Object.keys(BaseClawState.spec);
            expect(fields).toContain("messages");
            expect(fields).toContain("currentAgent");
            expect(fields).toContain("lastSpecialistAgent");
            expect(fields).toContain("phase");
            expect(fields).toContain("iterationCount");
            expect(fields).toContain("maxIterations");
            expect(fields).toContain("taskContext");
            expect(fields).toContain("activeSkills");
            expect(fields).toContain("workingMemory");
            expect(fields).toContain("attachedMCPServers");
            expect(fields).toContain("voiceInput");
            expect(fields).toContain("tenantId");
            expect(fields).toContain("hitlState");
            expect(fields).toContain("reviewerGateState");
            expect(fields).toHaveLength(14);
        });

        it("does not have any extra unexpected fields", () => {
            const expectedFields = [
                "messages",
                "currentAgent",
                "lastSpecialistAgent",
                "phase",
                "iterationCount",
                "maxIterations",
                "taskContext",
                "activeSkills",
                "workingMemory",
                "attachedMCPServers",
                "voiceInput",
                "tenantId",
                "hitlState",
                "reviewerGateState",
            ];
            const actualFields = Object.keys(BaseClawState.spec);
            expect(actualFields.sort()).toEqual(expectedFields.sort());
        });
    });

    describe("spec structure", () => {
        it("messages spec exists and is an object", () => {
            expect(BaseClawState.spec.messages).toBeDefined();
            expect(typeof BaseClawState.spec.messages).toBe("object");
        });

        it("currentAgent spec exists", () => {
            expect(BaseClawState.spec.currentAgent).toBeDefined();
        });

        it("phase spec exists", () => {
            expect(BaseClawState.spec.phase).toBeDefined();
        });

        it("iterationCount spec exists", () => {
            expect(BaseClawState.spec.iterationCount).toBeDefined();
        });

        it("maxIterations spec exists", () => {
            expect(BaseClawState.spec.maxIterations).toBeDefined();
        });

        it("taskContext spec exists", () => {
            expect(BaseClawState.spec.taskContext).toBeDefined();
        });

        it("activeSkills spec exists", () => {
            expect(BaseClawState.spec.activeSkills).toBeDefined();
        });

        it("workingMemory spec exists", () => {
            expect(BaseClawState.spec.workingMemory).toBeDefined();
        });

        it("hitlState spec exists (Level 9)", () => {
            expect(BaseClawState.spec.hitlState).toBeDefined();
        });
    });

    describe("reducer behavior (via graph invocation)", () => {
        // Reducers are tested implicitly through the graph integration tests.
        // Here we verify that the Annotation.Root itself creates a valid annotation.
        it("BaseClawState is a valid Annotation.Root", () => {
            expect(BaseClawState).toBeDefined();
            expect(BaseClawState.spec).toBeDefined();
            // Annotation.Root instances have a spec property with field definitions
            expect(typeof BaseClawState.spec).toBe("object");
        });
    });
});
