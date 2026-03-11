import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    initializeObservability,
    getProjectName,
    getEnvironment,
    getLangSmithClient,
    resetLangSmithClient,
} from "baseclaw-agent/src/observability/trace-config.js";

/**
 * Trace Configuration (Level 4) — no mocks, no spies.
 * Verifies env var state and client behavior after initialization.
 */

describe("Trace Configuration (Level 4)", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.LANGCHAIN_API_KEY;
        delete process.env.LANGCHAIN_TRACING_V2;
        delete process.env.LANGCHAIN_CALLBACKS_BACKGROUND;
        delete process.env.LANGCHAIN_PROJECT;
        delete process.env.NODE_ENV;
        resetLangSmithClient();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    // ── getEnvironment ──────────────────────────────────────

    it("returns 'dev' for development NODE_ENV", () => {
        process.env.NODE_ENV = "development";
        expect(getEnvironment()).toBe("dev");
    });

    it("returns 'dev' when NODE_ENV is not set", () => {
        delete process.env.NODE_ENV;
        expect(getEnvironment()).toBe("dev");
    });

    it("returns 'staging' for staging NODE_ENV", () => {
        process.env.NODE_ENV = "staging";
        expect(getEnvironment()).toBe("staging");
    });

    it("returns 'prod' for production NODE_ENV", () => {
        process.env.NODE_ENV = "production";
        expect(getEnvironment()).toBe("prod");
    });

    it("returns 'prod' for 'prod' NODE_ENV", () => {
        process.env.NODE_ENV = "prod";
        expect(getEnvironment()).toBe("prod");
    });

    // ── getProjectName ──────────────────────────────────────

    it("generates project name with environment suffix", () => {
        process.env.NODE_ENV = "development";
        expect(getProjectName()).toBe("base-agent-dev");
    });

    it("generates prod project name", () => {
        process.env.NODE_ENV = "production";
        expect(getProjectName()).toBe("base-agent-prod");
    });

    // ── initializeObservability ─────────────────────────────

    it("enables tracing when API key is set", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        initializeObservability();

        expect(process.env.LANGCHAIN_TRACING_V2).toBe("true");
        expect(process.env.LANGCHAIN_CALLBACKS_BACKGROUND).toBe("true");
    });

    it("defaults to BaseClaw when no project name is pre-set", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        process.env.NODE_ENV = "staging";
        initializeObservability();

        expect(process.env.LANGCHAIN_PROJECT).toBe("BaseClaw");
    });

    it("preserves pre-set project name (env-aware naming)", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        process.env.LANGCHAIN_PROJECT = "base-agent-staging";
        initializeObservability();

        expect(process.env.LANGCHAIN_PROJECT).toBe("base-agent-staging");
    });

    it("does not enable tracing when API key is missing", () => {
        delete process.env.LANGCHAIN_API_KEY;
        initializeObservability();

        expect(process.env.LANGCHAIN_TRACING_V2).not.toBe("true");
    });

    // ── getLangSmithClient ──────────────────────────────────

    it("returns null when API key is not set", () => {
        expect(getLangSmithClient()).toBeNull();
    });

    it("returns a Client when API key is set", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        const client = getLangSmithClient();
        expect(client).not.toBeNull();
    });

    it("returns same instance on multiple calls (singleton)", () => {
        process.env.LANGCHAIN_API_KEY = "ls__test-key";
        const client1 = getLangSmithClient();
        const client2 = getLangSmithClient();
        expect(client1).toBe(client2);
    });
});
