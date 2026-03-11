import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import {
    WhisperSTTProvider,
    DeepgramSTTProvider,
    createSTTProvider,
} from "baseclaw-agent/src/voice/stt/index.js";
import {
    requireEnvKey,
    makeAudioInput,
    generateTestAudio,
} from "../helpers/voice-test-helpers.js";

/**
 * STT Integration Tests — Real API Calls
 *
 * These tests make REAL calls to OpenAI Whisper and Deepgram.
 * If API keys are missing, tests FAIL immediately.
 * No mocks. No fakes. Real transcription.
 */

describe("Voice STT — Level 7 (Real API)", () => {
    let openaiKey: string;
    let deepgramKey: string;

    beforeAll(() => {
        openaiKey = requireEnvKey("OPENAI_API_KEY");
        deepgramKey = requireEnvKey("DEEPGRAM_API_KEY");
    });

    // ── WhisperSTTProvider — Real OpenAI Calls ──────────────

    describe("WhisperSTTProvider (Real Whisper API)", () => {
        it("has name 'whisper'", () => {
            const provider = new WhisperSTTProvider();
            expect(provider.name).toBe("whisper");
        });

        it("transcribes real audio via Whisper API", async () => {
            const provider = new WhisperSTTProvider();
            const audio = makeAudioInput();
            const result = await provider.transcribe(audio);

            expect(result.success).toBe(true);
            expect(result.provider).toBe("whisper");
            expect(typeof result.text).toBe("string");
            expect(typeof result.latencyMs).toBe("number");
            expect(result.latencyMs).toBeGreaterThan(0);
        }, 30000);

        it("returns confidence score from Whisper", async () => {
            const provider = new WhisperSTTProvider();
            const audio = makeAudioInput();
            const result = await provider.transcribe(audio);

            expect(result.success).toBe(true);
            if (result.confidence !== null) {
                expect(result.confidence).toBeGreaterThanOrEqual(0);
                expect(result.confidence).toBeLessThanOrEqual(1);
            }
        }, 30000);

        it("handles short audio (100ms sine wave)", async () => {
            const provider = new WhisperSTTProvider();
            const shortAudio = generateTestAudio(100);
            const audio = makeAudioInput({
                buffer: shortAudio,
                sizeBytes: shortAudio.length,
                durationMs: 100,
            });
            const result = await provider.transcribe(audio);

            // Short audio may produce empty text or succeed — either is valid
            expect(result.provider).toBe("whisper");
            expect(typeof result.latencyMs).toBe("number");
        }, 30000);

        it("returns all required STTResult fields", async () => {
            const provider = new WhisperSTTProvider();
            const result = await provider.transcribe(makeAudioInput());

            expect(result).toHaveProperty("text");
            expect(result).toHaveProperty("confidence");
            expect(result).toHaveProperty("provider");
            expect(result).toHaveProperty("latencyMs");
            expect(result).toHaveProperty("success");
        }, 30000);
    });

    // ── DeepgramSTTProvider — Real Deepgram Calls ───────────

    describe("DeepgramSTTProvider (Real Deepgram API)", () => {
        it("has name 'deepgram'", () => {
            const provider = new DeepgramSTTProvider();
            expect(provider.name).toBe("deepgram");
        });

        it("calls real Deepgram API and returns structured result", async () => {
            const provider = new DeepgramSTTProvider();
            const audio = makeAudioInput();
            const result = await provider.transcribe(audio);

            // Deepgram may succeed or return empty transcript for sine wave audio
            // The key assertion: it called the real API and returned a structured result
            expect(result.provider).toBe("deepgram");
            expect(typeof result.text).toBe("string");
            expect(typeof result.latencyMs).toBe("number");
            expect(result.latencyMs).toBeGreaterThan(0);

            if (result.success) {
                // If it transcribed something, confidence should be valid
                if (result.confidence !== null) {
                    expect(result.confidence).toBeGreaterThanOrEqual(0);
                    expect(result.confidence).toBeLessThanOrEqual(1);
                }
            } else {
                // If Deepgram rejected the audio, there should be an error message
                expect(result.errorMessage).toBeTruthy();
            }
        }, 30000);

        it("FAILS immediately when API key is empty", async () => {
            const originalKey = process.env.DEEPGRAM_API_KEY;
            process.env.DEEPGRAM_API_KEY = "";

            const provider = new DeepgramSTTProvider();
            const audio = makeAudioInput();
            const result = await provider.transcribe(audio);

            expect(result.success).toBe(false);
            expect(result.text).toBe("");
            expect(result.errorMessage).toBeTruthy();
            expect(result.provider).toBe("deepgram");

            process.env.DEEPGRAM_API_KEY = originalKey;
        }, 15000);

        it("FAILS with invalid API key", async () => {
            const originalKey = process.env.DEEPGRAM_API_KEY;
            process.env.DEEPGRAM_API_KEY = "invalid-key-12345";

            const provider = new DeepgramSTTProvider();
            const audio = makeAudioInput();
            const result = await provider.transcribe(audio);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeTruthy();

            process.env.DEEPGRAM_API_KEY = originalKey;
        }, 15000);
    });

    // ── Factory — Real Provider Creation ────────────────────

    describe("createSTTProvider() — real providers", () => {
        it("creates working WhisperSTTProvider by default", () => {
            const provider = createSTTProvider();
            expect(provider.name).toBe("whisper");
            expect(typeof provider.transcribe).toBe("function");
        });

        it("creates working DeepgramSTTProvider", () => {
            const provider = createSTTProvider("deepgram");
            expect(provider.name).toBe("deepgram");
            expect(typeof provider.transcribe).toBe("function");
        });

        it("falls back to whisper for unknown provider", () => {
            // @ts-expect-error — testing invalid input
            const provider = createSTTProvider("invalid");
            expect(provider.name).toBe("whisper");
        });
    });
});
