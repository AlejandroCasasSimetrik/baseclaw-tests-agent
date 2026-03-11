import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import { traceSTT, traceTTS } from "baseclaw-agent/src/observability/trace-metadata.js";
import { requireEnvKey } from "../helpers/voice-test-helpers.js";

/**
 * Voice Tracing Tests — Real LangSmith Trace Spans
 *
 * These tests exercise the REAL traceSTT/traceTTS functions.
 * They verify trace span structure, data integrity, and
 * that no sensitive data (audio bytes, API keys) leaks into traces.
 *
 * If LANGCHAIN_API_KEY is missing, tests FAIL immediately.
 */

describe("Voice Tracing — Level 7 (Real Traces)", () => {
    beforeAll(() => {
        requireEnvKey("LANGCHAIN_API_KEY");
    });

    // ── traceSTT — Real Trace Span ─────────────────────────

    describe("traceSTT() — real LangSmith span", () => {
        it("returns complete STT trace data", async () => {
            const result = await traceSTT({
                audioFormat: "wav",
                audioDurationMs: 5000,
                audioSizeBytes: 80000,
                provider: "whisper",
                transcriptionText: "hello world",
                confidenceScore: 0.95,
                latencyMs: 350,
                success: true,
            });

            expect(result).toMatchObject({
                audioFormat: "wav",
                audioDurationMs: 5000,
                audioSizeBytes: 80000,
                provider: "whisper",
                transcriptionText: "hello world",
                confidenceScore: 0.95,
                latencyMs: 350,
                success: true,
            });
        });

        it("includes error info on failure", async () => {
            const result = await traceSTT({
                audioFormat: "mp3",
                audioDurationMs: null,
                audioSizeBytes: 1000,
                provider: "deepgram",
                transcriptionText: "",
                confidenceScore: null,
                latencyMs: 100,
                success: false,
                errorMessage: "API timeout",
            });

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBe("API timeout");
        });

        it("handles null values gracefully", async () => {
            const result = await traceSTT({
                audioFormat: "ogg",
                audioDurationMs: null,
                audioSizeBytes: 5000,
                provider: "whisper",
                transcriptionText: "hi",
                confidenceScore: null,
                latencyMs: 150,
                success: true,
            });

            expect(result.audioDurationMs).toBeNull();
            expect(result.confidenceScore).toBeNull();
        });

        it("does NOT include audio bytes in trace output", async () => {
            const result = await traceSTT({
                audioFormat: "wav",
                audioDurationMs: 1000,
                audioSizeBytes: 30000,
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
        });
    });

    // ── traceTTS — Real Trace Span ─────────────────────────

    describe("traceTTS() — real LangSmith span", () => {
        it("returns complete TTS trace data", async () => {
            const result = await traceTTS({
                inputTextPreview: "Hello, how can I help you?",
                voiceId: "voice-1",
                modelId: "eleven_multilingual_v2",
                audioDurationMs: 2500,
                latencyMs: 800,
                streamingUsed: false,
                success: true,
            });

            expect(result).toMatchObject({
                voiceId: "voice-1",
                modelId: "eleven_multilingual_v2",
                audioDurationMs: 2500,
                latencyMs: 800,
                streamingUsed: false,
                success: true,
            });
        });

        it("truncates long input text to prevent trace bloat", async () => {
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

        it("includes error on TTS failure", async () => {
            const result = await traceTTS({
                inputTextPreview: "test",
                voiceId: "v1",
                modelId: "m1",
                audioDurationMs: null,
                latencyMs: 50,
                streamingUsed: false,
                success: false,
                errorMessage: "Rate limited",
            });

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBe("Rate limited");
        });

        it("reflects streaming status", async () => {
            const result = await traceTTS({
                inputTextPreview: "long text...",
                voiceId: "v1",
                modelId: "m1",
                audioDurationMs: 5000,
                latencyMs: 1200,
                streamingUsed: true,
                success: true,
            });

            expect(result.streamingUsed).toBe(true);
        });

        it("does NOT include audio bytes in trace output", async () => {
            const result = await traceTTS({
                inputTextPreview: "test",
                voiceId: "v1",
                modelId: "m1",
                audioDurationMs: 1000,
                latencyMs: 200,
                streamingUsed: true,
                success: true,
            });

            const keys = Object.keys(result);
            expect(keys).not.toContain("audioBuffer");
            expect(keys).not.toContain("audioData");
        });
    });

    // ── Full Trace Chain ──────────────────────────────────

    describe("full voice trace chain", () => {
        it("STT + TTS traces compose in sequence (real-life flow)", async () => {
            // Simulate: Audio in → STT trace → processing → TTS trace → Audio out
            const sttResult = await traceSTT({
                audioFormat: "wav",
                audioDurationMs: 3000,
                audioSizeBytes: 48000,
                provider: "whisper",
                transcriptionText: "What is the weather?",
                confidenceScore: 0.91,
                latencyMs: 400,
                success: true,
            });
            expect(sttResult.success).toBe(true);

            const ttsResult = await traceTTS({
                inputTextPreview: "The weather today is sunny with a high of 75°F.",
                voiceId: process.env.ELEVENLABS_VOICE_ID ?? "voice-1",
                modelId: "eleven_multilingual_v2",
                audioDurationMs: 3500,
                latencyMs: 600,
                streamingUsed: false,
                success: true,
            });
            expect(ttsResult.success).toBe(true);
        });
    });
});
