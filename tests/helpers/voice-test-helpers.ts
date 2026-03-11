/**
 * Voice Test Helpers — Shared Utilities for Real-API Voice Tests
 *
 * Provides:
 * - requireEnvKey(): Fails test immediately if API key is missing
 * - generateTestAudio(): Creates a valid WAV audio buffer with real PCM data
 * - makeAudioInput(): Creates an AudioInput for test use
 * - makeVoiceConfig(): Creates a VoiceConfig with real env values
 */

import "dotenv/config";
import type { AudioInput, VoiceConfig } from "baseclaw-agent/src/voice/types.js";

/**
 * Fails the test immediately if a required environment variable is missing.
 * Called at test suite level (describe block) to fail fast.
 */
export function requireEnvKey(name: string): string {
    const value = process.env[name];
    if (!value || value.startsWith("your-")) {
        throw new Error(
            `❌ Required API key missing: ${name}. ` +
            `Set it in .env to run voice integration tests.`
        );
    }
    return value;
}

/**
 * Generate a valid WAV audio buffer with PCM sine wave data.
 * This is real audio data that STT providers can accept without
 * rejecting it as "corrupted" or "invalid format".
 *
 * @param durationMs - Duration of the audio in milliseconds
 * @param sampleRate - Sample rate in Hz (default 16000 — good for STT)
 * @param frequency - Sine wave frequency (default 440Hz — A4 note)
 */
export function generateTestAudio(
    durationMs: number = 1000,
    sampleRate: number = 16000,
    frequency: number = 440
): Buffer {
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    const bytesPerSample = 2; // 16-bit PCM
    const numChannels = 1; // mono
    const dataSize = numSamples * bytesPerSample * numChannels;
    const headerSize = 44;
    const buffer = Buffer.alloc(headerSize + dataSize);

    // WAV header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4); // File size - 8
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // Chunk size
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // Byte rate
    buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // Block align
    buffer.writeUInt16LE(16, 34); // Bits per sample
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Generate sine wave PCM data
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const amplitude = Math.sin(2 * Math.PI * frequency * t);
        const sample = Math.floor(amplitude * 32767 * 0.3); // 30% volume
        buffer.writeInt16LE(sample, headerSize + i * bytesPerSample);
    }

    return buffer;
}

/**
 * Create an AudioInput with real WAV audio data.
 */
export function makeAudioInput(
    overrides: Partial<AudioInput> = {}
): AudioInput {
    const audioBuffer = generateTestAudio(1000); // 1 second
    return {
        buffer: audioBuffer,
        format: "wav",
        sizeBytes: audioBuffer.length,
        durationMs: 1000,
        filename: "test-audio.wav",
        ...overrides,
    };
}

/**
 * Create a VoiceConfig using real environment variable values.
 */
export function makeVoiceConfig(
    overrides: Partial<VoiceConfig> = {}
): VoiceConfig {
    return {
        tenantId: "test-tenant",
        sttProvider: (process.env.STT_PROVIDER as any) ?? "whisper",
        ttsEnabled: process.env.TTS_ENABLED !== "false",
        voiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
        modelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
        maxAudioDurationSeconds: 300,
        maxAudioSizeBytes: 25 * 1024 * 1024,
        ...overrides,
    };
}

/**
 * Short test text for TTS — keeps API calls cheap and fast.
 */
export const TEST_TTS_TEXT = "Hello, this is a test.";

/**
 * All required env keys for voice tests.
 */
export const REQUIRED_VOICE_KEYS = [
    "OPENAI_API_KEY",
    "DEEPGRAM_API_KEY",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_VOICE_ID",
] as const;
