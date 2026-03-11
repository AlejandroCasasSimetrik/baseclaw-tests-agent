import { describe, it, expect } from "vitest";
import {
    getFileCategory,
    isFileTypeAllowed,
    getChunkingStrategy,
    getFileExtension,
    ALLOWED_FILE_TYPES,
    CATEGORY_CHUNKING_MAP,
    MAX_FILE_SIZE_BYTES,
    RECURSIVE_CHUNK_CONFIG,
    ROW_GROUP_CONFIG,
    EMBEDDING_MODEL,
    EMBEDDING_BATCH_SIZE,
} from "baseclaw-agent/src/rag/config.js";

describe("RAG Config", () => {
    // ── Constants ──────────────────────────────────────────

    describe("constants", () => {
        it("MAX_FILE_SIZE_BYTES is a positive number", () => {
            expect(MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
        });

        it("ALLOWED_FILE_TYPES has entries", () => {
            expect(Object.keys(ALLOWED_FILE_TYPES).length).toBeGreaterThan(0);
        });

        it("CATEGORY_CHUNKING_MAP covers all categories used in ALLOWED_FILE_TYPES", () => {
            const usedCategories = new Set(Object.values(ALLOWED_FILE_TYPES));
            for (const cat of usedCategories) {
                expect(cat in CATEGORY_CHUNKING_MAP).toBe(true);
            }
        });

        it("RECURSIVE_CHUNK_CONFIG has valid parameters", () => {
            expect(RECURSIVE_CHUNK_CONFIG.targetSize).toBeGreaterThan(0);
            expect(RECURSIVE_CHUNK_CONFIG.overlapFraction).toBeGreaterThan(0);
            expect(RECURSIVE_CHUNK_CONFIG.overlapFraction).toBeLessThan(1);
            expect(RECURSIVE_CHUNK_CONFIG.separators.length).toBeGreaterThan(0);
        });

        it("ROW_GROUP_CONFIG has a positive rowsPerChunk", () => {
            expect(ROW_GROUP_CONFIG.rowsPerChunk).toBeGreaterThan(0);
        });

        it("EMBEDDING_MODEL is a non-empty string", () => {
            expect(typeof EMBEDDING_MODEL).toBe("string");
            expect(EMBEDDING_MODEL.length).toBeGreaterThan(0);
        });

        it("EMBEDDING_BATCH_SIZE is a positive number", () => {
            expect(EMBEDDING_BATCH_SIZE).toBeGreaterThan(0);
        });
    });

    // ── getFileCategory() ──────────────────────────────────

    describe("getFileCategory()", () => {
        it("returns 'document' for pdf", () => {
            expect(getFileCategory("pdf")).toBe("document");
        });

        it("returns 'code' for ts", () => {
            expect(getFileCategory("ts")).toBe("code");
        });

        it("returns 'web' for html", () => {
            expect(getFileCategory("html")).toBe("web");
        });

        it("returns 'media-image' for png", () => {
            expect(getFileCategory("png")).toBe("media-image");
        });

        it("returns 'media-audio' for mp3", () => {
            expect(getFileCategory("mp3")).toBe("media-audio");
        });

        it("returns 'media-video' for mp4", () => {
            expect(getFileCategory("mp4")).toBe("media-video");
        });

        it("returns undefined for unsupported extension", () => {
            expect(getFileCategory("xyz")).toBeUndefined();
        });

        it("handles leading dot in extension", () => {
            expect(getFileCategory(".ts")).toBe("code");
        });

        it("is case-insensitive", () => {
            expect(getFileCategory("PDF")).toBe("document");
            expect(getFileCategory("Ts")).toBe("code");
        });
    });

    // ── isFileTypeAllowed() ────────────────────────────────

    describe("isFileTypeAllowed()", () => {
        it("returns true for all registered extensions", () => {
            for (const ext of Object.keys(ALLOWED_FILE_TYPES)) {
                expect(isFileTypeAllowed(ext), `expected ${ext} to be allowed`).toBe(true);
            }
        });

        it("returns false for unknown extensions", () => {
            expect(isFileTypeAllowed("exe")).toBe(false);
            expect(isFileTypeAllowed("dll")).toBe(false);
            expect(isFileTypeAllowed("")).toBe(false);
        });

        it("handles leading dot", () => {
            expect(isFileTypeAllowed(".pdf")).toBe(true);
        });

        it("is case-insensitive", () => {
            expect(isFileTypeAllowed("PDF")).toBe(true);
        });
    });

    // ── getChunkingStrategy() ──────────────────────────────

    describe("getChunkingStrategy()", () => {
        it("returns 'page-level' for pdf", () => {
            expect(getChunkingStrategy("pdf")).toBe("page-level");
        });

        it("returns 'row-group' for xlsx", () => {
            expect(getChunkingStrategy("xlsx")).toBe("row-group");
        });

        it("returns 'row-group' for csv", () => {
            expect(getChunkingStrategy("csv")).toBe("row-group");
        });

        it("returns 'code-aware' for code files", () => {
            expect(getChunkingStrategy("ts")).toBe("code-aware");
            expect(getChunkingStrategy("py")).toBe("code-aware");
            expect(getChunkingStrategy("go")).toBe("code-aware");
        });

        it("returns 'recursive-text' for plain text documents", () => {
            expect(getChunkingStrategy("txt")).toBe("recursive-text");
            expect(getChunkingStrategy("md")).toBe("recursive-text");
            expect(getChunkingStrategy("docx")).toBe("recursive-text");
        });

        it("returns null for media files (single chunk)", () => {
            expect(getChunkingStrategy("png")).toBeNull();
            expect(getChunkingStrategy("mp3")).toBeNull();
            expect(getChunkingStrategy("mp4")).toBeNull();
        });

        it("returns null for unknown extensions", () => {
            expect(getChunkingStrategy("xyz")).toBeNull();
        });
    });

    // ── getFileExtension() ─────────────────────────────────

    describe("getFileExtension()", () => {
        it("extracts extension from filename", () => {
            expect(getFileExtension("report.pdf")).toBe("pdf");
        });

        it("handles multiple dots", () => {
            expect(getFileExtension("archive.tar.gz")).toBe("gz");
        });

        it("returns lowercase", () => {
            expect(getFileExtension("Photo.PNG")).toBe("png");
        });

        it("returns empty string when no extension", () => {
            expect(getFileExtension("Makefile")).toBe("");
        });

        it("handles dot-only filenames", () => {
            expect(getFileExtension(".gitignore")).toBe("gitignore");
        });
    });
});
