import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initializeTracing } from "baseclaw-agent/src/tracing.js";

/**
 * Tracing initialization tests — no mocks, no spies.
 * Verifies env var state after initialization.
 */

describe("initializeTracing", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Clean tracing-related env vars before each test
        delete process.env.LANGCHAIN_API_KEY;
        delete process.env.LANGCHAIN_TRACING_V2;
        delete process.env.LANGCHAIN_CALLBACKS_BACKGROUND;
        delete process.env.LANGCHAIN_PROJECT;
    });

    afterEach(() => {
        // Restore original env
        process.env = { ...originalEnv };
    });

    it("enables tracing when LANGCHAIN_API_KEY is set", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        initializeTracing();

        expect(process.env.LANGCHAIN_TRACING_V2).toBe("true");
        expect(process.env.LANGCHAIN_CALLBACKS_BACKGROUND).toBe("true");
    });

    it("sets default project name to BaseClaw when not configured", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        delete process.env.LANGCHAIN_PROJECT;
        initializeTracing();

        expect(process.env.LANGCHAIN_PROJECT).toBe("BaseClaw");
    });

    it("preserves custom project name when set", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        process.env.LANGCHAIN_PROJECT = "CustomProject";
        initializeTracing();

        expect(process.env.LANGCHAIN_PROJECT).toBe("CustomProject");
    });

    it("does not enable tracing when API key is missing", () => {
        delete process.env.LANGCHAIN_API_KEY;
        initializeTracing();

        // LANGCHAIN_TRACING_V2 should NOT be set to "true"
        expect(process.env.LANGCHAIN_TRACING_V2).not.toBe("true");
    });

    it("does not throw when API key is missing", () => {
        delete process.env.LANGCHAIN_API_KEY;
        expect(() => initializeTracing()).not.toThrow();
    });
});
