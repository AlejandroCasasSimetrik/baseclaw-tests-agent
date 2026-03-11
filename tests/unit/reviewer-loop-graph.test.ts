import { describe, it, expect } from "vitest";
import { buildGraph } from "baseclaw-agent/src/graph.js";

describe("Level 10 — Graph Integration", () => {
    describe("graph compilation", () => {
        it("compiles without errors", () => {
            expect(() => buildGraph()).not.toThrow();
        });

        it("returns a compiled graph with invoke and stream methods", () => {
            const graph = buildGraph();
            expect(graph).toBeDefined();
            expect(typeof graph.invoke).toBe("function");
            expect(typeof graph.stream).toBe("function");
        });
    });

    describe("node structure", () => {
        it("contains all 5 agent nodes", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();

            expect(mermaid).toContain("conversation");
            expect(mermaid).toContain("ideation");
            expect(mermaid).toContain("planning");
            expect(mermaid).toContain("execution");
            expect(mermaid).toContain("reviewer");
        });

        it("has exactly 5 agent nodes (no extras)", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();

            // Count node definition lines (word(word) pattern)
            const nodeLines = mermaid
                .split("\n")
                .filter(
                    (line: string) =>
                        line.trim().match(/^\w+\(/) &&
                        !line.includes("__start__") &&
                        !line.includes("__end__")
                );
            expect(nodeLines).toHaveLength(5);
        });

        it("has __start__ connecting to conversation", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();
            expect(mermaid).toContain("__start__");
            expect(mermaid).toMatch(/__start__.*-->.*conversation/s);
        });

        it("renders a valid Mermaid diagram", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();
            expect(mermaid).toBeTruthy();
            expect(mermaid.length).toBeGreaterThan(50);
            expect(mermaid).toContain("graph TD");
        });
    });

    describe("agent node presence", () => {
        it("ideation node is defined", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();
            expect(mermaid).toMatch(/ideation\(ideation\)/);
        });

        it("planning node is defined", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();
            expect(mermaid).toMatch(/planning\(planning\)/);
        });

        it("execution node is defined", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();
            expect(mermaid).toMatch(/execution\(execution\)/);
        });

        it("reviewer node is defined", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();
            expect(mermaid).toMatch(/reviewer\(reviewer\)/);
        });
    });

    describe("graph structure", () => {
        it("getGraph returns valid object with nodes and edges", () => {
            const graph = buildGraph();
            const drawableGraph = graph.getGraph();
            expect(drawableGraph).toBeDefined();
            expect(drawableGraph.nodes).toBeDefined();
            expect(drawableGraph.edges).toBeDefined();
        });

        it("has at least one edge (__start__ → conversation)", () => {
            const graph = buildGraph();
            const drawableGraph = graph.getGraph();
            expect(drawableGraph.edges.length).toBeGreaterThanOrEqual(1);
        });

        it("can be compiled multiple times independently", () => {
            const graph1 = buildGraph();
            const graph2 = buildGraph();
            expect(graph1).toBeDefined();
            expect(graph2).toBeDefined();
            expect(graph1).not.toBe(graph2);
        });
    });
});
