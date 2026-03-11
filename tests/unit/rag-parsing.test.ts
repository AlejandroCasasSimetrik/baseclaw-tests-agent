/**
 * Level 5 — RAG Parsing Tests
 *
 * Tests parser routing by file category, code language detection,
 * and fallback behavior.
 */

import { describe, it, expect } from "vitest";
import { detectLanguage } from "baseclaw-agent/src/rag/parsers/code-parser.js";
import { getFileCategory, getFileExtension, isFileTypeAllowed } from "baseclaw-agent/src/rag/config.js";


describe("Level 5 — RAG Parsing", () => {
    describe("detectLanguage", () => {
        it("detects JavaScript from .js", () => {
            expect(detectLanguage("js")).toBe("javascript");
        });

        it("detects TypeScript from .ts", () => {
            expect(detectLanguage("ts")).toBe("typescript");
        });

        it("detects Python from .py", () => {
            expect(detectLanguage("py")).toBe("python");
        });

        it("detects Java from .java", () => {
            expect(detectLanguage("java")).toBe("java");
        });

        it("detects Go from .go", () => {
            expect(detectLanguage("go")).toBe("go");
        });

        it("detects Rust from .rs", () => {
            expect(detectLanguage("rs")).toBe("rust");
        });

        it("returns 'unknown' for unrecognized extensions", () => {
            expect(detectLanguage("xyz")).toBe("unknown");
        });

        it("handles extensions with leading dot", () => {
            expect(detectLanguage(".py")).toBe("python");
        });
    });

    describe("getFileExtension", () => {
        it("extracts extension from filename", () => {
            expect(getFileExtension("document.pdf")).toBe("pdf");
        });

        it("extracts from dotted names", () => {
            expect(getFileExtension("my.file.name.ts")).toBe("ts");
        });

        it("returns empty for no extension", () => {
            expect(getFileExtension("README")).toBe("");
        });

        it("lowercases extensions", () => {
            expect(getFileExtension("FILE.PDF")).toBe("pdf");
        });
    });

    describe("isFileTypeAllowed", () => {
        it("allows supported types", () => {
            expect(isFileTypeAllowed("pdf")).toBe(true);
            expect(isFileTypeAllowed("ts")).toBe(true);
            expect(isFileTypeAllowed("json")).toBe(true);
            expect(isFileTypeAllowed("png")).toBe(true);
        });

        it("rejects unsupported types", () => {
            expect(isFileTypeAllowed("exe")).toBe(false);
            expect(isFileTypeAllowed("dll")).toBe(false);
            expect(isFileTypeAllowed("bat")).toBe(false);
        });

        it("handles case insensitivity", () => {
            expect(isFileTypeAllowed("PDF")).toBe(true);
            expect(isFileTypeAllowed("Ts")).toBe(true);
        });
    });

    describe("parser routing by category", () => {
        it("routes documents to document category", () => {
            expect(getFileCategory("pdf")).toBe("document");
            expect(getFileCategory("docx")).toBe("document");
            expect(getFileCategory("pptx")).toBe("document");
            expect(getFileCategory("xlsx")).toBe("document");
        });

        it("routes web files to web category", () => {
            expect(getFileCategory("html")).toBe("web");
            expect(getFileCategory("xml")).toBe("web");
            expect(getFileCategory("json")).toBe("web");
            expect(getFileCategory("yaml")).toBe("web");
        });

        it("routes code files to code category", () => {
            expect(getFileCategory("js")).toBe("code");
            expect(getFileCategory("ts")).toBe("code");
            expect(getFileCategory("py")).toBe("code");
        });

        it("routes images to media-image category", () => {
            expect(getFileCategory("png")).toBe("media-image");
            expect(getFileCategory("jpg")).toBe("media-image");
            expect(getFileCategory("svg")).toBe("media-image");
        });

        it("routes audio to media-audio category", () => {
            expect(getFileCategory("mp3")).toBe("media-audio");
            expect(getFileCategory("wav")).toBe("media-audio");
        });

        it("routes video to media-video category", () => {
            expect(getFileCategory("mp4")).toBe("media-video");
            expect(getFileCategory("mov")).toBe("media-video");
        });
    });

    describe("code parser", async () => {
        const { parseCodeFile } = await import("../../src/rag/parsers/code-parser.js");

        it("extracts text from code buffer", async () => {
            const code = "const x = 42;\nconsole.log(x);";
            const result = await parseCodeFile("test.js", Buffer.from(code), "js");
            expect(result.text).toBe(code);
            expect(result.parserUsed).toBe("code-reader");
        });

        it("detects language in metadata", async () => {
            const result = await parseCodeFile("app.py", Buffer.from("print('hello')"), "py");
            expect(result.parserMetadata.language).toBe("python");
        });

        it("counts lines", async () => {
            const code = "line1\nline2\nline3";
            const result = await parseCodeFile("test.ts", Buffer.from(code), "ts");
            expect(result.parserMetadata.lineCount).toBe(3);
        });
    });

    describe("media parsers", async () => {
        const { parseImage, parseAudio, parseVideo } = await import("../../src/rag/parsers/media-parser.js");

        it("returns OCR stub for images", async () => {
            const result = await parseImage("photo.png", Buffer.from(""), "png");
            expect(result.parserUsed).toBe("ocr-stub");
            expect(result.text).toContain("[OCR: photo.png]");
        });

        it("returns STT stub for audio", async () => {
            const result = await parseAudio("recording.mp3", Buffer.from(""), "mp3");
            expect(result.parserUsed).toBe("stt-stub");
            expect(result.text).toContain("[Transcription: recording.mp3]");
        });

        it("returns stub for video", async () => {
            const result = await parseVideo("clip.mp4", Buffer.from(""), "mp4");
            expect(result.parserUsed).toBe("video-stub");
            expect(result.text).toContain("[Video: clip.mp4]");
        });
    });

    describe("web parser", async () => {
        const { parseWebFile } = await import("../../src/rag/parsers/index.js");

        it("extracts text from web files", async () => {
            const html = "<html><body>Hello World</body></html>";
            const result = await parseWebFile("page.html", Buffer.from(html), "html");
            expect(result.text).toBe(html);
            expect(result.parserUsed).toBe("web-reader");
        });

        it("preserves JSON structure", async () => {
            const json = '{"key": "value", "nested": {"a": 1}}';
            const result = await parseWebFile("data.json", Buffer.from(json), "json");
            expect(result.text).toBe(json);
        });
    });
});
