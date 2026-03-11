/**
 * Level 5 — RAG Chunking Tests
 *
 * Tests hybrid adaptive chunking strategies:
 *   - PDF → page-level
 *   - Text → recursive with overlap
 *   - Code → language-aware boundaries
 *   - Spreadsheets → row-group with headers
 *   - Strategy routing by file type
 */

import { describe, it, expect } from "vitest";
import { chunkByPage } from "baseclaw-agent/src/rag/chunking/page-chunker.js";
import { chunkRecursive } from "baseclaw-agent/src/rag/chunking/recursive-chunker.js";
import { chunkCode } from "baseclaw-agent/src/rag/chunking/code-chunker.js";
import { chunkByRows } from "baseclaw-agent/src/rag/chunking/spreadsheet-chunker.js";
import { getChunkingStrategy, getFileCategory } from "baseclaw-agent/src/rag/config.js";
import type { RAGChunkMetadata } from "baseclaw-agent/src/rag/types.js";


const BASE_METADATA: Omit<RAGChunkMetadata, "chunk_index" | "chunk_total"> = {
    source_file: "test-file.txt",
    file_type: "txt",
    upload_timestamp: "2026-01-01T00:00:00Z",
    active_phase: "ideation",
    active_agent: "conversation",
    tenant_id: "tenant-123",
};

describe("Level 5 — RAG Chunking", () => {
    // ── Strategy Routing ───────────────────────────────────
    describe("strategy routing", () => {
        it("routes PDF to page-level chunking", () => {
            expect(getChunkingStrategy("pdf")).toBe("page-level");
        });

        it("routes TXT to recursive-text chunking", () => {
            expect(getChunkingStrategy("txt")).toBe("recursive-text");
        });

        it("routes MD to recursive-text chunking", () => {
            expect(getChunkingStrategy("md")).toBe("recursive-text");
        });

        it("routes HTML to recursive-text chunking", () => {
            expect(getChunkingStrategy("html")).toBe("recursive-text");
        });

        it("routes JS to code-aware chunking", () => {
            expect(getChunkingStrategy("js")).toBe("code-aware");
        });

        it("routes PY to code-aware chunking", () => {
            expect(getChunkingStrategy("py")).toBe("code-aware");
        });

        it("routes CSV to row-group chunking", () => {
            expect(getChunkingStrategy("csv")).toBe("row-group");
        });

        it("routes XLSX to row-group chunking", () => {
            expect(getChunkingStrategy("xlsx")).toBe("row-group");
        });

        it("routes PNG to null (single chunk)", () => {
            expect(getChunkingStrategy("png")).toBeNull();
        });

        it("returns null for unknown types", () => {
            expect(getChunkingStrategy("xyz")).toBeNull();
        });
    });

    // ── Page-Level Chunking (PDF) ──────────────────────────
    describe("chunkByPage", () => {
        it("splits at page boundaries", () => {
            const text = "Page 1 content\n---PAGE---\nPage 2 content\n---PAGE---\nPage 3 content";
            const chunks = chunkByPage(text, BASE_METADATA);
            expect(chunks).toHaveLength(3);
            expect(chunks[0].text).toBe("Page 1 content");
            expect(chunks[1].text).toBe("Page 2 content");
            expect(chunks[2].text).toBe("Page 3 content");
        });

        it("skips empty pages", () => {
            const text = "Page 1\n---PAGE---\n\n---PAGE---\nPage 3";
            const chunks = chunkByPage(text, BASE_METADATA);
            expect(chunks).toHaveLength(2);
        });

        it("attaches correct metadata", () => {
            const text = "Page 1\n---PAGE---\nPage 2";
            const chunks = chunkByPage(text, BASE_METADATA);
            expect(chunks[0].metadata.chunk_index).toBe("0");
            expect(chunks[0].metadata.chunk_total).toBe("2");
            expect(chunks[0].metadata.source_file).toBe("test-file.txt");
            expect(chunks[0].metadata.tenant_id).toBe("tenant-123");
            expect(chunks[1].metadata.chunk_index).toBe("1");
        });

        it("handles single page (no separator)", () => {
            const chunks = chunkByPage("Single page content", BASE_METADATA);
            expect(chunks).toHaveLength(1);
            expect(chunks[0].metadata.chunk_total).toBe("1");
        });
    });

    // ── Recursive Text Chunking ────────────────────────────
    describe("chunkRecursive", () => {
        it("keeps small text in single chunk", () => {
            const chunks = chunkRecursive("Short text.", BASE_METADATA);
            expect(chunks).toHaveLength(1);
        });

        it("splits large text into multiple chunks", () => {
            const longText = "Paragraph one. ".repeat(200) + "\n\n" + "Paragraph two. ".repeat(200);
            const chunks = chunkRecursive(longText, BASE_METADATA, {
                targetSize: 500,
                overlapFraction: 0.1,
            });
            expect(chunks.length).toBeGreaterThan(1);
        });

        it("respects target size", () => {
            const text = Array(100).fill("This is a sentence. ").join("\n");
            const targetSize = 500;
            const chunks = chunkRecursive(text, BASE_METADATA, { targetSize, overlapFraction: 0 });
            for (const chunk of chunks) {
                // With overlap=0, chunks should be at or near targetSize
                expect(chunk.text.length).toBeLessThanOrEqual(targetSize * 1.5);
            }
        });

        it("adds overlap between chunks", () => {
            const text = "A".repeat(400) + "\n\n" + "B".repeat(400) + "\n\n" + "C".repeat(400);
            const chunks = chunkRecursive(text, BASE_METADATA, {
                targetSize: 500,
                overlapFraction: 0.15,
            });
            if (chunks.length > 1) {
                // Overlap means the end of chunk[0] appears at the start of chunk[1]
                const lastOfFirst = chunks[0].text.slice(-50);
                expect(chunks[1].text).toContain(lastOfFirst.slice(0, 30));
            }
        });

        it("sets correct chunk_total for all chunks", () => {
            const text = "Content. ".repeat(500);
            const chunks = chunkRecursive(text, BASE_METADATA, { targetSize: 200 });
            const total = chunks[0].metadata.chunk_total;
            for (const chunk of chunks) {
                expect(chunk.metadata.chunk_total).toBe(total);
            }
        });
    });

    // ── Code-Aware Chunking ────────────────────────────────
    describe("chunkCode", () => {
        it("splits TypeScript at function boundaries", () => {
            const code = `import { foo } from "bar";

export function helperA() {
    console.log("A");
}

export function helperB() {
    console.log("B");
}

export class MyClass {
    method() {}
}`;
            const chunks = chunkCode(code, BASE_METADATA, "typescript", 100);
            expect(chunks.length).toBeGreaterThan(1);
        });

        it("splits Python at def/class boundaries", () => {
            const code = `import os

def function_a():
    print("a")

def function_b():
    print("b")

class MyClass:
    def method(self):
        pass`;
            const chunks = chunkCode(code, BASE_METADATA, "python", 80);
            expect(chunks.length).toBeGreaterThan(1);
        });

        it("keeps small code files in a single chunk", () => {
            const code = `const x = 1;\nconsole.log(x);`;
            const chunks = chunkCode(code, BASE_METADATA, "javascript");
            expect(chunks).toHaveLength(1);
        });

        it("attaches metadata to all chunks", () => {
            const code = "function a() {}\n\nfunction b() {}";
            const chunks = chunkCode(code, BASE_METADATA, "javascript", 20);
            for (const chunk of chunks) {
                expect(chunk.metadata.source_file).toBe("test-file.txt");
                expect(chunk.metadata.tenant_id).toBe("tenant-123");
            }
        });
    });

    // ── Spreadsheet Row-Group Chunking ─────────────────────
    describe("chunkByRows", () => {
        it("attaches header to every chunk", () => {
            const csv = "Name,Age,City\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF\nDiana,28,CHI\nEve,42,SEA";
            const chunks = chunkByRows(csv, BASE_METADATA, 2);
            expect(chunks).toHaveLength(3);
            for (const chunk of chunks) {
                expect(chunk.text).toContain("Name,Age,City");
            }
        });

        it("handles header-only file", () => {
            const chunks = chunkByRows("Name,Age,City", BASE_METADATA);
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe("Name,Age,City");
        });

        it("handles empty content", () => {
            const chunks = chunkByRows("", BASE_METADATA);
            expect(chunks).toHaveLength(0);
        });

        it("groups correct number of rows per chunk", () => {
            const rows = Array.from({ length: 10 }, (_, i) => `row${i},data${i}`);
            const csv = "header,col\n" + rows.join("\n");
            const chunks = chunkByRows(csv, BASE_METADATA, 3);
            // 10 data rows / 3 per chunk = 4 chunks (last one has 1 row)
            expect(chunks).toHaveLength(4);
        });

        it("sets correct chunk_total", () => {
            const csv = "h1,h2\na,1\nb,2\nc,3\nd,4";
            const chunks = chunkByRows(csv, BASE_METADATA, 2);
            expect(chunks[0].metadata.chunk_total).toBe(String(chunks.length));
        });
    });

    // ── File Category Detection ────────────────────────────
    describe("getFileCategory", () => {
        it("classifies document types", () => {
            expect(getFileCategory("pdf")).toBe("document");
            expect(getFileCategory("docx")).toBe("document");
            expect(getFileCategory("txt")).toBe("document");
        });

        it("classifies web types", () => {
            expect(getFileCategory("html")).toBe("web");
            expect(getFileCategory("json")).toBe("web");
            expect(getFileCategory("yaml")).toBe("web");
        });

        it("classifies code types", () => {
            expect(getFileCategory("ts")).toBe("code");
            expect(getFileCategory("py")).toBe("code");
            expect(getFileCategory("go")).toBe("code");
        });

        it("classifies media types", () => {
            expect(getFileCategory("png")).toBe("media-image");
            expect(getFileCategory("mp3")).toBe("media-audio");
            expect(getFileCategory("mp4")).toBe("media-video");
        });

        it("returns undefined for unsupported types", () => {
            expect(getFileCategory("exe")).toBeUndefined();
        });
    });
});
