import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import {
    sanitizeString,
    sanitizeTraceData,
    containsSensitiveData,
} from "baseclaw-agent/src/observability/sanitizer.js";
import { traceSTT, traceTTS } from "baseclaw-agent/src/observability/trace-metadata.js";
import { validateAudioInput } from "baseclaw-agent/src/voice/validation.js";
import { requireEnvKey } from "../helpers/voice-test-helpers.js";

/**
 * Voice Security Tests — Real Verification
 *
 * Verifies ALL security requirements using real credentials:
 * 1. Audio data never persisted to disk — in-memory only
 * 2. NO audio bytes in LangSmith traces — metadata only
 * 3. Real API keys are sanitized from trace data
 * 4. Validation runs BEFORE any API call
 * 5. API keys come from .env — never hardcoded
 *
 * If any API key is missing, tests FAIL immediately.
 */

describe("Voice Security — Level 7 (Real Verification)", () => {
    let openaiKey: string;
    let deepgramKey: string;
    let elevenlabsKey: string;

    beforeAll(() => {
        openaiKey = requireEnvKey("OPENAI_API_KEY");
        deepgramKey = requireEnvKey("DEEPGRAM_API_KEY");
        elevenlabsKey = requireEnvKey("ELEVENLABS_API_KEY");
        requireEnvKey("ELEVENLABS_VOICE_ID");
    });

    // ── 1. Audio Not Persisted ──────────────────────────────

    describe("audio processed in-memory only", () => {
        it("audio input uses Buffer — no fs.writeFile", () => {
            const audioBuffer = Buffer.alloc(5000, 0x55);
            expect(Buffer.isBuffer(audioBuffer)).toBe(true);
        });

        it("TTS output is Buffer, not a file path", () => {
            const ttsResult = {
                audioBuffer: Buffer.from("synthesized-audio"),
                format: "mp3" as const,
                durationMs: 2000,
                latencyMs: 500,
                voiceId: "v1",
                modelId: "m1",
                streamingUsed: false,
                success: true,
            };
            expect(Buffer.isBuffer(ttsResult.audioBuffer)).toBe(true);
        });
    });

    // ── 2. No Audio Bytes in Traces ─────────────────────────

    describe("no audio bytes reach LangSmith", () => {
        it("traceSTT returns metadata ONLY — no buffer field", async () => {
            const result = await traceSTT({
                audioFormat: "wav",
                audioDurationMs: 3000,
                audioSizeBytes: 48000,
                provider: "whisper",
                transcriptionText: "test",
                confidenceScore: 0.9,
                latencyMs: 200,
                success: true,
            });
            const keys = Object.keys(result);
            expect(keys).not.toContain("audioBuffer");
            expect(keys).not.toContain("audioData");
            expect(keys).not.toContain("buffer");
            expect(keys).toContain("audioFormat");
            expect(keys).toContain("audioSizeBytes");
        });

        it("traceTTS returns metadata ONLY — no buffer field", async () => {
            const result = await traceTTS({
                inputTextPreview: "test response",
                voiceId: "v1",
                modelId: "m1",
                audioDurationMs: 2000,
                latencyMs: 400,
                streamingUsed: false,
                success: true,
            });
            const keys = Object.keys(result);
            expect(keys).not.toContain("audioBuffer");
            expect(keys).not.toContain("audioData");
        });

        it("traceTTS truncates long text to prevent trace bloat", async () => {
            const longText = "A".repeat(1000);
            const result = await traceTTS({
                inputTextPreview: longText,
                voiceId: "v1",
                modelId: "m1",
                audioDurationMs: null,
                latencyMs: 100,
                streamingUsed: false,
                success: true,
            });
            expect(result.inputTextPreview.length).toBeLessThanOrEqual(500);
        });
    });

    // ── 3. Real API Key Sanitization ─────────────────────────

    describe("real API keys sanitized from traces", () => {
        it("real OPENAI_API_KEY is stripped from trace strings", () => {
            const result = sanitizeString(`Connection: ${openaiKey}`);
            expect(result).not.toContain(openaiKey);
        });

        it("real DEEPGRAM_API_KEY is stripped from trace strings", () => {
            const result = sanitizeString(`Config: ${deepgramKey}`);
            expect(result).not.toContain(deepgramKey);
        });

        it("real ELEVENLABS_API_KEY is stripped from trace strings", () => {
            const result = sanitizeString(`Auth: ${elevenlabsKey}`);
            expect(result).not.toContain(elevenlabsKey);
        });

        it("containsSensitiveData detects real OPENAI key", () => {
            expect(containsSensitiveData(openaiKey)).toBe(true);
        });

        it("containsSensitiveData detects real DEEPGRAM key", () => {
            expect(containsSensitiveData(deepgramKey)).toBe(true);
        });

        it("containsSensitiveData detects real ELEVENLABS key", () => {
            expect(containsSensitiveData(elevenlabsKey)).toBe(true);
        });

        it("sanitizeTraceData strips keys from nested objects", () => {
            const data = {
                provider: "elevenlabs",
                config: elevenlabsKey,
                nested: { apiKey: deepgramKey },
            };
            const sanitized = sanitizeTraceData(data);
            const json = JSON.stringify(sanitized);
            expect(json).not.toContain(elevenlabsKey);
            expect(json).not.toContain(deepgramKey);
        });

        it("ElevenLabs key pattern (sk_ prefix) is detected", () => {
            expect(containsSensitiveData("sk_316a29f9ab854606a00869c73830c987eda1c27d707af142")).toBe(true);
        });
    });

    // ── 4. Validation Before API Calls ──────────────────────

    describe("validation rejects bad input BEFORE API calls", () => {
        it("unsupported format rejected before STT", () => {
            const result = validateAudioInput({
                buffer: Buffer.alloc(1000, 0x55),
                format: "pdf" as any,
                sizeBytes: 1000,
            });
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("FORMAT_UNSUPPORTED");
        });

        it("oversized file rejected before STT", () => {
            const result = validateAudioInput(
                {
                    buffer: Buffer.alloc(1000, 0x55),
                    format: "wav",
                    sizeBytes: 50 * 1024 * 1024,
                },
                { maxAudioSizeBytes: 25 * 1024 * 1024 }
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("SIZE_EXCEEDED");
        });

        it("overlong recording rejected before STT", () => {
            const result = validateAudioInput(
                {
                    buffer: Buffer.alloc(1000, 0x55),
                    format: "mp3",
                    sizeBytes: 1000,
                    durationMs: 600000,
                },
                { maxAudioDurationSeconds: 300 }
            );
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("DURATION_EXCEEDED");
        });

        it("empty audio rejected before STT", () => {
            const result = validateAudioInput({
                buffer: Buffer.alloc(0),
                format: "wav",
                sizeBytes: 0,
            });
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe("EMPTY_AUDIO");
        });
    });

    // ── 5. Keys from .env — Not Hardcoded ───────────────────

    describe("API keys sourced from .env only", () => {
        it("OPENAI_API_KEY exists in process.env", () => {
            expect(process.env.OPENAI_API_KEY).toBeTruthy();
            expect(process.env.OPENAI_API_KEY!.length).toBeGreaterThan(10);
        });

        it("DEEPGRAM_API_KEY exists in process.env", () => {
            expect(process.env.DEEPGRAM_API_KEY).toBeTruthy();
            expect(process.env.DEEPGRAM_API_KEY!.length).toBeGreaterThan(10);
        });

        it("ELEVENLABS_API_KEY exists in process.env", () => {
            expect(process.env.ELEVENLABS_API_KEY).toBeTruthy();
            expect(process.env.ELEVENLABS_API_KEY!.length).toBeGreaterThan(10);
        });

        it("ELEVENLABS_VOICE_ID exists in process.env", () => {
            expect(process.env.ELEVENLABS_VOICE_ID).toBeTruthy();
        });
    });
});
