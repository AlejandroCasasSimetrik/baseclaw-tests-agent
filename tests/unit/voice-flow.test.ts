import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import {
    processVoiceInput,
    generateVoiceResponse,
} from "baseclaw-agent/src/agents/conversation.js";
import {
    requireEnvKey,
    makeAudioInput,
    makeVoiceConfig,
    TEST_TTS_TEXT,
} from "../helpers/voice-test-helpers.js";
import type { VoiceConfig } from "baseclaw-agent/src/voice/types.js";

/**
 * Voice Flow Integration Tests — Real End-to-End Pipeline
 *
 * Tests the ACTUAL voice processing pipeline:
 * - processVoiceInput: real audio → real STT API → transcribed text
 * - generateVoiceResponse: real text → real TTS API → real audio
 *
 * No mocks. If any API key is missing, tests FAIL immediately.
 */

describe("Voice Flow — Level 7 (Real API)", () => {
    let config: VoiceConfig;

    beforeAll(() => {
        requireEnvKey("OPENAI_API_KEY");
        requireEnvKey("ELEVENLABS_API_KEY");
        requireEnvKey("ELEVENLABS_VOICE_ID");
        config = makeVoiceConfig();
    });

    // ── processVoiceInput — Real STT ───────────────────────

    describe("processVoiceInput() — real STT pipeline", () => {
        it("processes valid audio through real Whisper API", async () => {
            const audio = makeAudioInput();
            const result = await processVoiceInput(audio, config);

            // The sine wave audio may produce empty text or some text
            // Key thing: the API was actually called and returned
            expect(result.errorMessage).toBeNull();
            expect(result.voiceInputState).not.toBeNull();
            expect(result.voiceInputState!.sttProvider).toBe(config.sttProvider);
            expect(typeof result.voiceInputState!.confidence).not.toBe("undefined");
        }, 30000);

        it("returns VoiceInputState with real metadata", async () => {
            const audio = makeAudioInput({
                format: "wav",
                durationMs: 1000,
                sizeBytes: 32044, // size of 1s 16kHz 16-bit WAV
            });
            const result = await processVoiceInput(audio, config);

            expect(result.voiceInputState).not.toBeNull();
            expect(result.voiceInputState!.audioFormat).toBe("wav");
            expect(result.voiceInputState!.sttProvider).toBe("whisper");
        }, 30000);

        it("rejects unsupported audio format BEFORE hitting API", async () => {
            const audio = makeAudioInput({ format: "aac" as any });
            const result = await processVoiceInput(audio, config);

            expect(result.transcribedText).toBe("");
            expect(result.errorMessage).toContain("Unsupported audio format");
            expect(result.voiceInputState).toBeNull();
        });

        it("rejects empty audio BEFORE hitting API", async () => {
            const audio = makeAudioInput({
                buffer: Buffer.alloc(0),
                sizeBytes: 0,
            });
            const result = await processVoiceInput(audio, config);

            expect(result.transcribedText).toBe("");
            expect(result.errorMessage).toBeTruthy();
        });

        it("rejects oversized audio BEFORE hitting API", async () => {
            const audio = makeAudioInput({
                sizeBytes: 30 * 1024 * 1024, // 30 MB
            });
            const result = await processVoiceInput(
                audio,
                makeVoiceConfig({ maxAudioSizeBytes: 25 * 1024 * 1024 })
            );

            expect(result.transcribedText).toBe("");
            expect(result.errorMessage).toContain("too large");
        });

        it("rejects audio exceeding duration limit BEFORE hitting API", async () => {
            const audio = makeAudioInput({ durationMs: 600000 }); // 10 min
            const result = await processVoiceInput(
                audio,
                makeVoiceConfig({ maxAudioDurationSeconds: 300 })
            );

            expect(result.transcribedText).toBe("");
            expect(result.errorMessage).toContain("too long");
        });
    });

    // ── generateVoiceResponse — Real TTS ───────────────────

    describe("generateVoiceResponse() — real TTS pipeline", () => {
        it("synthesizes real audio from text via ElevenLabs", async () => {
            const result = await generateVoiceResponse(
                TEST_TTS_TEXT,
                config
            );

            expect(result).not.toBeNull();
            expect(result!.success).toBe(true);
            expect(result!.audioBuffer).not.toBeNull();
            expect(result!.audioBuffer!.length).toBeGreaterThan(0);
            expect(result!.format).toBe("mp3");
        }, 30000);

        it("returns null when TTS is disabled", async () => {
            const result = await generateVoiceResponse(
                TEST_TTS_TEXT,
                makeVoiceConfig({ ttsEnabled: false })
            );
            expect(result).toBeNull();
        });

        it("returns null when voice ID is empty", async () => {
            const result = await generateVoiceResponse(
                TEST_TTS_TEXT,
                makeVoiceConfig({ voiceId: "" })
            );
            expect(result).toBeNull();
        });

        it("TTS failure does NOT throw — returns null gracefully", async () => {
            // Use an invalid voice ID to trigger a real API error
            const result = await generateVoiceResponse(
                TEST_TTS_TEXT,
                makeVoiceConfig({ voiceId: "invalid-voice-id-xyz" })
            );
            // Should return null or error result — never throw
            // Text response would still be delivered
            expect(result === null || result.success === false).toBe(true);
        }, 15000);
    });

    // ── Full Round-Trip — Real Audio ───────────────────────

    describe("full voice round-trip (real-life scenario)", () => {
        it("Audio in → STT → text ready for pipeline → TTS → audio out", async () => {
            // Step 1: Process voice input through real Whisper
            const voiceResult = await processVoiceInput(
                makeAudioInput(),
                config
            );
            expect(voiceResult.errorMessage).toBeNull();
            expect(voiceResult.voiceInputState).not.toBeNull();

            // Step 2: Generate voice response through real ElevenLabs
            const ttsResult = await generateVoiceResponse(
                "The answer to your question is yes.",
                config
            );
            expect(ttsResult).not.toBeNull();
            expect(ttsResult!.success).toBe(true);
            expect(ttsResult!.audioBuffer!.length).toBeGreaterThan(0);
        }, 45000);

        it("voice and text produce compatible output for pipeline", async () => {
            const voiceResult = await processVoiceInput(
                makeAudioInput(),
                config
            );

            // Voice produces a string just like text input
            expect(typeof voiceResult.transcribedText).toBe("string");
            // Both are strings — pipeline treats them identically
            const textInput = "This is typed text";
            expect(typeof textInput).toBe("string");
        }, 30000);
    });
});
