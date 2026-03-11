import { describe, it, expect } from "vitest";
import {
    SUPPORTED_AUDIO_FORMATS,
    DEFAULT_MAX_AUDIO_DURATION_SECONDS,
    DEFAULT_MAX_AUDIO_SIZE_BYTES,
    DEFAULT_STT_PROVIDER,
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_ENABLED,
    isValidAudioFormat,
    isValidSTTProvider,
    isValidVoiceConfig,
} from "baseclaw-agent/src/voice/types.js";
import type {
    AudioInput,
    STTResult,
    TTSResult,
    VoiceConfig,
    VoiceInputState,
    AudioValidationResult,
    VoiceInfo,
} from "baseclaw-agent/src/voice/types.js";

describe("Voice Types — Level 7", () => {
    // ── Audio Format Constants ─────────────────────────────

    describe("SUPPORTED_AUDIO_FORMATS", () => {
        it("includes all required formats", () => {
            const required = ["wav", "mp3", "m4a", "ogg", "webm"];
            for (const fmt of required) {
                expect(SUPPORTED_AUDIO_FORMATS).toContain(fmt);
            }
        });

        it("is a readonly array", () => {
            expect(Array.isArray(SUPPORTED_AUDIO_FORMATS)).toBe(true);
            expect(SUPPORTED_AUDIO_FORMATS.length).toBeGreaterThanOrEqual(5);
        });
    });

    // ── Defaults ───────────────────────────────────────────

    describe("defaults", () => {
        it("DEFAULT_MAX_AUDIO_DURATION_SECONDS is 300 (5 minutes)", () => {
            expect(DEFAULT_MAX_AUDIO_DURATION_SECONDS).toBe(300);
        });

        it("DEFAULT_MAX_AUDIO_SIZE_BYTES is 25 MB", () => {
            expect(DEFAULT_MAX_AUDIO_SIZE_BYTES).toBe(25 * 1024 * 1024);
        });

        it("DEFAULT_STT_PROVIDER is 'whisper'", () => {
            expect(DEFAULT_STT_PROVIDER).toBe("whisper");
        });

        it("DEFAULT_TTS_MODEL is 'eleven_multilingual_v2'", () => {
            expect(DEFAULT_TTS_MODEL).toBe("eleven_multilingual_v2");
        });

        it("DEFAULT_TTS_ENABLED is true", () => {
            expect(DEFAULT_TTS_ENABLED).toBe(true);
        });
    });

    // ── isValidAudioFormat ─────────────────────────────────

    describe("isValidAudioFormat()", () => {
        it("returns true for supported formats", () => {
            expect(isValidAudioFormat("wav")).toBe(true);
            expect(isValidAudioFormat("mp3")).toBe(true);
            expect(isValidAudioFormat("m4a")).toBe(true);
            expect(isValidAudioFormat("ogg")).toBe(true);
            expect(isValidAudioFormat("webm")).toBe(true);
        });

        it("returns false for unsupported formats", () => {
            expect(isValidAudioFormat("aac")).toBe(false);
            expect(isValidAudioFormat("flac")).toBe(false);
            expect(isValidAudioFormat("")).toBe(false);
            expect(isValidAudioFormat("pdf")).toBe(false);
        });
    });

    // ── isValidSTTProvider ─────────────────────────────────

    describe("isValidSTTProvider()", () => {
        it("returns true for 'whisper'", () => {
            expect(isValidSTTProvider("whisper")).toBe(true);
        });

        it("returns true for 'deepgram'", () => {
            expect(isValidSTTProvider("deepgram")).toBe(true);
        });

        it("returns false for invalid providers", () => {
            expect(isValidSTTProvider("google")).toBe(false);
            expect(isValidSTTProvider("")).toBe(false);
            expect(isValidSTTProvider("azure")).toBe(false);
        });
    });

    // ── isValidVoiceConfig ─────────────────────────────────

    describe("isValidVoiceConfig()", () => {
        function makeConfig(overrides: Partial<VoiceConfig> = {}): VoiceConfig {
            return {
                tenantId: "tenant-1",
                sttProvider: "whisper",
                ttsEnabled: true,
                voiceId: "voice-123",
                modelId: "eleven_multilingual_v2",
                maxAudioDurationSeconds: 300,
                maxAudioSizeBytes: 25 * 1024 * 1024,
                ...overrides,
            };
        }

        it("returns true for a valid config", () => {
            expect(isValidVoiceConfig(makeConfig())).toBe(true);
        });

        it("returns true with deepgram provider", () => {
            expect(isValidVoiceConfig(makeConfig({ sttProvider: "deepgram" }))).toBe(true);
        });

        it("returns false for null", () => {
            expect(isValidVoiceConfig(null)).toBe(false);
        });

        it("returns false for undefined", () => {
            expect(isValidVoiceConfig(undefined)).toBe(false);
        });

        it("returns false for non-object", () => {
            expect(isValidVoiceConfig("string")).toBe(false);
            expect(isValidVoiceConfig(42)).toBe(false);
        });

        it("returns false with invalid STT provider", () => {
            expect(isValidVoiceConfig({ ...makeConfig(), sttProvider: "google" as any })).toBe(false);
        });

        it("returns false when ttsEnabled is not boolean", () => {
            expect(isValidVoiceConfig({ ...makeConfig(), ttsEnabled: "yes" as any })).toBe(false);
        });

        it("returns false when maxAudioDurationSeconds is not number", () => {
            expect(isValidVoiceConfig({ ...makeConfig(), maxAudioDurationSeconds: "300" as any })).toBe(false);
        });
    });

    // ── Type Shape Verification ────────────────────────────

    describe("type shapes", () => {
        it("AudioInput has required fields", () => {
            const input: AudioInput = {
                buffer: Buffer.from("test"),
                format: "wav",
                sizeBytes: 100,
            };
            expect(input.buffer).toBeDefined();
            expect(input.format).toBe("wav");
            expect(input.sizeBytes).toBe(100);
        });

        it("STTResult has required fields", () => {
            const result: STTResult = {
                text: "hello",
                confidence: 0.95,
                provider: "whisper",
                latencyMs: 500,
                success: true,
            };
            expect(result.text).toBe("hello");
            expect(result.success).toBe(true);
        });

        it("TTSResult has required fields", () => {
            const result: TTSResult = {
                audioBuffer: Buffer.from("audio"),
                format: "mp3",
                durationMs: 3000,
                latencyMs: 200,
                voiceId: "v1",
                modelId: "m1",
                streamingUsed: false,
                success: true,
            };
            expect(result.format).toBe("mp3");
            expect(result.success).toBe(true);
        });

        it("VoiceInputState has required fields", () => {
            const state: VoiceInputState = {
                audioFormat: "mp3",
                durationMs: 5000,
                sizeBytes: 80000,
                transcribedText: "hello world",
                sttProvider: "whisper",
                confidence: 0.9,
            };
            expect(state.transcribedText).toBe("hello world");
        });
    });
});
