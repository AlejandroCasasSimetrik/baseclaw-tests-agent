import { describe, it, expect } from "vitest";
import {
    validateAudioInput,
    isAudioSilent,
    isSupportedFormat,
    extractAudioFormat,
} from "baseclaw-agent/src/voice/validation.js";
import type { AudioInput } from "baseclaw-agent/src/voice/types.js";

describe("Voice Validation — Level 7", () => {
    function makeAudio(overrides: Partial<AudioInput> = {}): AudioInput {
        return {
            buffer: Buffer.alloc(10000, 0x55), // non-zero bytes
            format: "wav",
            sizeBytes: 10000,
            durationMs: 5000,
            ...overrides,
        };
    }

    // ── validateAudioInput ─────────────────────────────────

    describe("validateAudioInput()", () => {
        it("passes for valid audio", () => {
            const result = validateAudioInput(makeAudio());
            expect(result.valid).toBe(true);
            expect(result.errorCode).toBeNull();
            expect(result.errorMessage).toBeNull();
        });

        it("rejects unsupported format", () => {
            const result = validateAudioInput(
                makeAudio({ format: "flac" as any })
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("FORMAT_UNSUPPORTED");
            expect(result.errorMessage).toContain("flac");
        });

        it("rejects empty buffer", () => {
            const result = validateAudioInput(
                makeAudio({ buffer: Buffer.alloc(0), sizeBytes: 0 })
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("EMPTY_AUDIO");
        });

        it("rejects file exceeding size limit", () => {
            const maxSize = 1000;
            const result = validateAudioInput(
                makeAudio({ sizeBytes: 2000 }),
                { maxAudioSizeBytes: maxSize }
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("SIZE_EXCEEDED");
            expect(result.errorMessage).toContain("too large");
        });

        it("rejects audio exceeding duration limit", () => {
            const result = validateAudioInput(
                makeAudio({ durationMs: 600000 }), // 10 minutes
                { maxAudioDurationSeconds: 300 }
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("DURATION_EXCEEDED");
            expect(result.errorMessage).toContain("too long");
        });

        it("passes when duration is under limit", () => {
            const result = validateAudioInput(
                makeAudio({ durationMs: 60000, sizeBytes: 100000, buffer: Buffer.alloc(100000, 0x55) }), // 1 minute, 100KB buffer
                { maxAudioDurationSeconds: 300 }
            );
            expect(result.valid).toBe(true);
        });

        it("skips duration check when durationMs is undefined", () => {
            const result = validateAudioInput(
                makeAudio({ durationMs: undefined })
            );
            expect(result.valid).toBe(true);
        });

        it("detects silent audio (all zero bytes)", () => {
            const silentBuffer = Buffer.alloc(10000, 0);
            const result = validateAudioInput(
                makeAudio({ buffer: silentBuffer })
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("SILENT_AUDIO");
        });

        it("uses default limits when no config provided", () => {
            const result = validateAudioInput(makeAudio());
            expect(result.valid).toBe(true);
        });

        it("uses custom limits from config", () => {
            const result = validateAudioInput(
                makeAudio({ sizeBytes: 500 }),
                { maxAudioSizeBytes: 100 }
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("SIZE_EXCEEDED");
        });
    });

    // ── isAudioSilent ──────────────────────────────────────

    describe("isAudioSilent()", () => {
        it("returns true for empty buffer", () => {
            expect(isAudioSilent(makeAudio({ buffer: Buffer.alloc(0) }))).toBe(true);
        });

        it("returns true for all-zero buffer", () => {
            expect(isAudioSilent(makeAudio({ buffer: Buffer.alloc(5000, 0) }))).toBe(true);
        });

        it("returns false for non-zero buffer", () => {
            expect(isAudioSilent(makeAudio({ buffer: Buffer.alloc(5000, 0x55) }))).toBe(false);
        });

        it("returns true for implausibly small buffer relative to duration", () => {
            expect(
                isAudioSilent(
                    makeAudio({
                        buffer: Buffer.alloc(10, 0x55),
                        durationMs: 60000, // 1 minute but only 10 bytes
                    })
                )
            ).toBe(true);
        });
    });

    // ── isSupportedFormat ──────────────────────────────────

    describe("isSupportedFormat()", () => {
        it("returns true for wav", () => {
            expect(isSupportedFormat("wav")).toBe(true);
        });

        it("returns true for mp3", () => {
            expect(isSupportedFormat("mp3")).toBe(true);
        });

        it("returns false for unsupported", () => {
            expect(isSupportedFormat("aac")).toBe(false);
        });
    });

    // ── extractAudioFormat ─────────────────────────────────

    describe("extractAudioFormat()", () => {
        it("extracts format from filename", () => {
            expect(extractAudioFormat("recording.mp3")).toBe("mp3");
            expect(extractAudioFormat("audio.wav")).toBe("wav");
        });

        it("extracts format from MIME type", () => {
            expect(extractAudioFormat("audio/wav")).toBe("wav");
            expect(extractAudioFormat("audio/mp3")).toBe("mp3");
        });

        it("returns null for unrecognized input", () => {
            expect(extractAudioFormat("random-string")).toBeNull();
        });

        it("is case-insensitive for extensions", () => {
            expect(extractAudioFormat("file.MP3")).toBe("mp3");
        });
    });
});
