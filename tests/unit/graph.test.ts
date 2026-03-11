import { describe, it, expect } from "vitest";
import { buildGraph } from "baseclaw-agent/src/graph.js";

describe("Graph Assembly", () => {
    it("compiles without errors", () => {
        expect(() => buildGraph()).not.toThrow();
    });

    it("returns a compiled graph with an invoke method", () => {
        const graph = buildGraph();
        expect(graph).toBeDefined();
        expect(typeof graph.invoke).toBe("function");
    });

    it("returns a compiled graph with a stream method", () => {
        const graph = buildGraph();
        expect(typeof graph.stream).toBe("function");
    });

    describe("node structure (via Mermaid)", () => {
        it("contains all 5 agent nodes", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();

            expect(mermaid).toContain("conversation");
            expect(mermaid).toContain("ideation");
            expect(mermaid).toContain("planning");
            expect(mermaid).toContain("execution");
            expect(mermaid).toContain("reviewer");
        });

        it("has exactly 5 nodes (no extras)", () => {
            const graph = buildGraph();
            const mermaid = graph.getGraph().drawMermaid();

            const nodeLines = mermaid
                .split("\n")
                .filter(
                    (line: string) =>
                        line.trim().match(/^\w+\(/) && !line.includes("__start__") && !line.includes("__end__")
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

    describe("graph drawable object", () => {
        it("getGraph returns valid object with nodes and edges", () => {
            const graph = buildGraph();
            const drawableGraph = graph.getGraph();

            expect(drawableGraph).toBeDefined();
            expect(drawableGraph.nodes).toBeDefined();
            expect(drawableGraph.edges).toBeDefined();
        });

        it("has edges connecting agents", () => {
            const graph = buildGraph();
            const drawableGraph = graph.getGraph();

            // Should have at least the __start__ → conversation edge
            expect(drawableGraph.edges.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("multiple compilations", () => {
        it("can be compiled multiple times independently", () => {
            const graph1 = buildGraph();
            const graph2 = buildGraph();

            expect(graph1).toBeDefined();
            expect(graph2).toBeDefined();
            expect(graph1).not.toBe(graph2); // Different instances
        });
    });
});
