import { describe, it, expect } from "vitest";
import {
    sttEvents,
    ttsEvents,
    voiceConfig,
    allTables,
    COMMON_COLUMNS,
} from "baseclaw-agent/src/memory/episodic/schema.js";
import type { STTEventInput, TTSEventInput } from "baseclaw-agent/src/memory/types.js";

describe("Voice Memory — Level 7", () => {
    // ── Schema Validation ──────────────────────────────────

    describe("sttEvents table", () => {
        it("exists in allTables", () => {
            expect(allTables.sttEvents).toBeDefined();
        });

        it("has required columns", () => {
            const columns = Object.keys(sttEvents);
            const required = [
                "id",
                "tenantId",
                "audioFormat",
                "audioSizeBytes",
                "provider",
                "latencyMs",
                "success",
                "episodeId",
                "langsmithTraceId",
                "createdAt",
            ];
            for (const col of required) {
                expect(columns).toContain(col);
            }
        });

        it("has optional columns", () => {
            const columns = Object.keys(sttEvents);
            expect(columns).toContain("audioDurationMs");
            expect(columns).toContain("transcriptionText");
            expect(columns).toContain("confidenceScore");
            expect(columns).toContain("errorMessage");
        });
    });

    describe("ttsEvents table", () => {
        it("exists in allTables", () => {
            expect(allTables.ttsEvents).toBeDefined();
        });

        it("has required columns", () => {
            const columns = Object.keys(ttsEvents);
            const required = [
                "id",
                "tenantId",
                "inputTextPreview",
                "voiceId",
                "modelId",
                "latencyMs",
                "streamingUsed",
                "success",
                "episodeId",
                "langsmithTraceId",
                "createdAt",
            ];
            for (const col of required) {
                expect(columns).toContain(col);
            }
        });

        it("has optional columns", () => {
            const columns = Object.keys(ttsEvents);
            expect(columns).toContain("audioDurationMs");
            expect(columns).toContain("errorMessage");
        });
    });

    describe("voiceConfig table", () => {
        it("exists in allTables", () => {
            expect(allTables.voiceConfig).toBeDefined();
        });

        it("has required columns", () => {
            const columns = Object.keys(voiceConfig);
            const required = [
                "id",
                "tenantId",
                "sttProvider",
                "ttsEnabled",
                "createdAt",
            ];
            for (const col of required) {
                expect(columns).toContain(col);
            }
        });

        it("has config columns", () => {
            const columns = Object.keys(voiceConfig);
            expect(columns).toContain("voiceId");
            expect(columns).toContain("modelId");
            expect(columns).toContain("maxAudioDurationSeconds");
            expect(columns).toContain("maxAudioSizeBytes");
            expect(columns).toContain("updatedAt");
        });
    });

    // ── Common Columns ────────────────────────────────────

    describe("common columns on voice tables", () => {
        it("sttEvents has id and tenant_id columns", () => {
            const columns = Object.keys(sttEvents);
            expect(columns).toContain("id");
            expect(columns).toContain("tenantId");
        });

        it("ttsEvents has id and tenant_id columns", () => {
            const columns = Object.keys(ttsEvents);
            expect(columns).toContain("id");
            expect(columns).toContain("tenantId");
        });

        it("sttEvents has langsmithTraceId", () => {
            const columns = Object.keys(sttEvents);
            expect(columns).toContain("langsmithTraceId");
        });

        it("ttsEvents has langsmithTraceId", () => {
            const columns = Object.keys(ttsEvents);
            expect(columns).toContain("langsmithTraceId");
        });
    });

    // ── allTables count ────────────────────────────────────

    describe("allTables", () => {
        it("includes all 12 tables (7 original + 3 voice + 2 heartbeat)", () => {
            expect(Object.keys(allTables)).toHaveLength(12);
        });

        it("includes voice tables", () => {
            expect(allTables).toHaveProperty("sttEvents");
            expect(allTables).toHaveProperty("ttsEvents");
            expect(allTables).toHaveProperty("voiceConfig");
        });

        it("preserves original 7 tables", () => {
            expect(allTables).toHaveProperty("episodes");
            expect(allTables).toHaveProperty("decisions");
            expect(allTables).toHaveProperty("hitlEvents");
            expect(allTables).toHaveProperty("fileUploads");
            expect(allTables).toHaveProperty("feedbackLoops");
            expect(allTables).toHaveProperty("subAgentEvents");
            expect(allTables).toHaveProperty("mcpUsage");
        });

        it("includes Level 9 heartbeat tables", () => {
            expect(allTables).toHaveProperty("continuousTasks");
            expect(allTables).toHaveProperty("heartbeatLock");
        });
    });

    // ── Type Shape Verification ────────────────────────────

    describe("STTEventInput type", () => {
        it("has correct shape", () => {
            const input: STTEventInput = {
                audioFormat: "wav",
                audioDurationMs: 3000,
                audioSizeBytes: 48000,
                provider: "whisper",
                transcriptionText: "hello",
                confidenceScore: "0.95",
                latencyMs: 350,
                success: "true",
                errorMessage: null,
                episodeId: "ep-1",
                langsmithTraceId: "trace-1",
            };
            expect(input.provider).toBe("whisper");
            expect(input.langsmithTraceId).toBe("trace-1");
        });
    });

    describe("TTSEventInput type", () => {
        it("has correct shape", () => {
            const input: TTSEventInput = {
                inputTextPreview: "Hello",
                voiceId: "voice-1",
                modelId: "eleven_multilingual_v2",
                audioDurationMs: 2000,
                latencyMs: 500,
                streamingUsed: "false",
                success: "true",
                errorMessage: null,
                episodeId: "ep-1",
                langsmithTraceId: "trace-1",
            };
            expect(input.voiceId).toBe("voice-1");
            expect(input.langsmithTraceId).toBe("trace-1");
        });
    });
});
