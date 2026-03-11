import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import { ElevenLabsTTSProvider } from "baseclaw-agent/src/voice/tts/elevenlabs.js";
import {
    requireEnvKey,
    TEST_TTS_TEXT,
} from "../helpers/voice-test-helpers.js";

/**
 * TTS Integration Tests — Real ElevenLabs API Calls
 *
 * These tests make REAL calls to ElevenLabs.
 * If API keys are missing, tests FAIL immediately.
 * No mocks. No fakes. Real speech synthesis.
 */

describe("Voice TTS — Level 7 (Real API)", () => {
    let apiKey: string;
    let voiceId: string;

    beforeAll(() => {
        apiKey = requireEnvKey("ELEVENLABS_API_KEY");
        voiceId = requireEnvKey("ELEVENLABS_VOICE_ID");
    });

    // ── Real Synthesis ─────────────────────────────────────

    describe("synthesize() — real ElevenLabs API", () => {
        it("synthesizes text to real audio", async () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const result = await provider.synthesize(
                TEST_TTS_TEXT,
                voiceId,
                "eleven_multilingual_v2"
            );

            expect(result.success).toBe(true);
            expect(result.audioBuffer).not.toBeNull();
            expect(result.audioBuffer!.length).toBeGreaterThan(0);
            expect(result.format).toBe("mp3");
            expect(result.voiceId).toBe(voiceId);
            expect(result.modelId).toBe("eleven_multilingual_v2");
        }, 30000);

        it("measures real latency", async () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const result = await provider.synthesize(
                TEST_TTS_TEXT,
                voiceId
            );

            expect(result.latencyMs).toBeGreaterThan(0);
            // A real API call should take at least a few ms
            expect(result.latencyMs).toBeGreaterThan(10);
        }, 30000);

        it("estimates audio duration from real output", async () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const result = await provider.synthesize(
                TEST_TTS_TEXT,
                voiceId
            );

            expect(result.durationMs).toBeGreaterThan(0);
        }, 30000);

        it("uses default model when not specified", async () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const result = await provider.synthesize(
                "Hi",
                voiceId
            );

            // Default model should work
            expect(result.success).toBe(true);
        }, 30000);
    });

    // ── Missing / Invalid API Key ──────────────────────────

    describe("missing/invalid API key — real failure modes", () => {
        it("FAILS with structured error when API key is empty", async () => {
            const provider = new ElevenLabsTTSProvider("");
            const result = await provider.synthesize("Hi", voiceId);

            expect(result.success).toBe(false);
            expect(result.audioBuffer).toBeNull();
            expect(result.errorMessage).toContain("ELEVENLABS_API_KEY");
        });

        it("FAILS with structured error for invalid API key", async () => {
            const provider = new ElevenLabsTTSProvider("invalid-key-abc123");
            const result = await provider.synthesize("Hi", voiceId);

            expect(result.success).toBe(false);
            expect(result.audioBuffer).toBeNull();
            expect(result.errorMessage).toBeTruthy();
        }, 15000);

        it("NEVER throws — always returns result object", async () => {
            const provider = new ElevenLabsTTSProvider("bad-key");
            // Must not throw — returns structured error
            const result = await provider.synthesize("Hi", voiceId);
            expect(result).toBeDefined();
            expect(result).toHaveProperty("success");
            expect(result).toHaveProperty("audioBuffer");
        }, 15000);
    });

    // ── Long Text Chunking ─────────────────────────────────

    describe("chunkText() — long response handling", () => {
        it("returns single chunk for short text", () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const chunks = provider.chunkText("Hello world");
            expect(chunks).toHaveLength(1);
            expect(chunks[0]).toBe("Hello world");
        });

        it("chunks long text into manageable pieces", () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const longText = Array(20)
                .fill("This is a paragraph that is moderately long. ".repeat(10))
                .join("\n\n");
            const chunks = provider.chunkText(longText);
            expect(chunks.length).toBeGreaterThan(1);
            for (const chunk of chunks) {
                expect(chunk.length).toBeLessThanOrEqual(5100);
            }
        });

        it("handles text with newlines and paragraphs", () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
            const chunks = provider.chunkText(text);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ── Voice Listing — Real API ───────────────────────────

    describe("listVoices() — real ElevenLabs API", () => {
        it("returns real voice list from ElevenLabs", async () => {
            const provider = new ElevenLabsTTSProvider(apiKey);
            const voices = await provider.listVoices();

            expect(voices.length).toBeGreaterThan(0);
            // Each voice should have expected fields
            for (const voice of voices.slice(0, 3)) {
                expect(voice.voiceId).toBeTruthy();
                expect(voice.name).toBeTruthy();
            }
        }, 15000);

        it("returns empty array when API key is invalid", async () => {
            const provider = new ElevenLabsTTSProvider("invalid-key");
            const voices = await provider.listVoices();
            expect(voices).toEqual([]);
        }, 15000);
    });
});
