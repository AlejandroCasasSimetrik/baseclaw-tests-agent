import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import "dotenv/config";
import {
    getVoiceConfig,
    updateVoiceConfig,
    getDefaultVoiceConfig,
    clearConfigCache,
} from "baseclaw-agent/src/voice/config.js";
import { requireEnvKey } from "../helpers/voice-test-helpers.js";
import type { VoiceConfig } from "baseclaw-agent/src/voice/types.js";

/**
 * Voice Config Tests — Real Environment Variables
 *
 * Tests config management using REAL env vars from .env.
 * No mocked DB — config uses in-memory cache + defaults.
 * If required env vars are missing, tests FAIL.
 */

describe("Voice Config — Level 7 (Real Env)", () => {
    beforeAll(() => {
        // Verify all required keys exist
        requireEnvKey("OPENAI_API_KEY");
        requireEnvKey("DEEPGRAM_API_KEY");
        requireEnvKey("ELEVENLABS_API_KEY");
        requireEnvKey("ELEVENLABS_VOICE_ID");
    });

    beforeEach(() => {
        clearConfigCache();
    });

    // ── getDefaultVoiceConfig — Real Env ───────────────────

    describe("getDefaultVoiceConfig() — reads real .env", () => {
        it("reads STT_PROVIDER from real .env", () => {
            const config = getDefaultVoiceConfig("t1");
            const expected = process.env.STT_PROVIDER ?? "whisper";
            expect(config.sttProvider).toBe(expected);
        });

        it("reads ELEVENLABS_VOICE_ID from real .env", () => {
            const config = getDefaultVoiceConfig("t1");
            expect(config.voiceId).toBe(process.env.ELEVENLABS_VOICE_ID);
        });

        it("reads ELEVENLABS_MODEL_ID from real .env", () => {
            const config = getDefaultVoiceConfig("t1");
            const expected = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
            expect(config.modelId).toBe(expected);
        });

        it("includes the tenant ID in config", () => {
            const config = getDefaultVoiceConfig("my-project");
            expect(config.tenantId).toBe("my-project");
        });

        it("has sensible defaults for limits", () => {
            const config = getDefaultVoiceConfig("t1");
            expect(config.maxAudioDurationSeconds).toBeGreaterThan(0);
            expect(config.maxAudioSizeBytes).toBeGreaterThan(0);
        });

        it("TTS is enabled", () => {
            const config = getDefaultVoiceConfig("t1");
            expect(config.ttsEnabled).toBe(true);
        });
    });

    // ── getVoiceConfig — Cache Behavior ────────────────────

    describe("getVoiceConfig() — cache and fallback", () => {
        it("returns config with correct tenant ID", async () => {
            const config = await getVoiceConfig("new-tenant");
            expect(config.tenantId).toBe("new-tenant");
        });

        it("caches config — second call returns same data", async () => {
            const config1 = await getVoiceConfig("cached-t");
            const config2 = await getVoiceConfig("cached-t");
            expect(config1).toEqual(config2);
        });

        it("different tenants get independent configs", async () => {
            const a = await getVoiceConfig("tenant-a");
            const b = await getVoiceConfig("tenant-b");
            expect(a.tenantId).toBe("tenant-a");
            expect(b.tenantId).toBe("tenant-b");
        });

        it("clearConfigCache forces fresh read", async () => {
            await getVoiceConfig("tenant-c");
            clearConfigCache();
            const config = await getVoiceConfig("tenant-c");
            expect(config.tenantId).toBe("tenant-c");
        });
    });

    // ── updateVoiceConfig — Runtime Changes ────────────────

    describe("updateVoiceConfig() — runtime changes", () => {
        it("updates TTS enabled/disabled", async () => {
            const updated = await updateVoiceConfig("tenant-u", {
                ttsEnabled: false,
            });
            expect(updated.ttsEnabled).toBe(false);
            expect(updated.tenantId).toBe("tenant-u");
        });

        it("preserves unchanged fields", async () => {
            const original = await getVoiceConfig("tenant-p");
            const updated = await updateVoiceConfig("tenant-p", {
                voiceId: "new-voice-456",
            });
            expect(updated.voiceId).toBe("new-voice-456");
            expect(updated.sttProvider).toBe(original.sttProvider);
        });

        it("switches STT provider at runtime", async () => {
            const updated = await updateVoiceConfig("tenant-s", {
                sttProvider: "deepgram",
            });
            expect(updated.sttProvider).toBe("deepgram");
        });

        it("rejects invalid STT provider", async () => {
            await expect(
                updateVoiceConfig("tenant-r", {
                    sttProvider: "azure_speech" as any,
                })
            ).rejects.toThrow("Invalid STT provider");
        });

        it("updates are reflected in subsequent reads", async () => {
            await updateVoiceConfig("tenant-cache", { ttsEnabled: false });
            const cached = await getVoiceConfig("tenant-cache");
            expect(cached.ttsEnabled).toBe(false);
        });
    });

    // ── Multi-Tenant Isolation ─────────────────────────────

    describe("multi-tenant isolation", () => {
        it("config change on tenant A does NOT affect tenant B", async () => {
            await updateVoiceConfig("tenant-iso-a", { ttsEnabled: false });
            const configB = await getVoiceConfig("tenant-iso-b");
            expect(configB.ttsEnabled).toBe(true);
        });

        it("different tenants can have different providers", async () => {
            await updateVoiceConfig("t-whisper", { sttProvider: "whisper" });
            await updateVoiceConfig("t-deepgram", { sttProvider: "deepgram" });
            const w = await getVoiceConfig("t-whisper");
            const d = await getVoiceConfig("t-deepgram");
            expect(w.sttProvider).toBe("whisper");
            expect(d.sttProvider).toBe("deepgram");
        });
    });
});
