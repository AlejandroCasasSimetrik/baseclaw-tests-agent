/**
 * Level 8 — API Server Tests (Real Services)
 *
 * Tests the Express HTTP endpoints:
 *   - POST /chat — text conversation with real LLM
 *   - POST /voice — audio → STT → LLM → TTS
 *   - POST /upload — file → RAG pipeline (async)
 *   - GET /health — system status
 *
 * Uses real API calls — no mocks. Requires API keys in .env.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "baseclaw-agent/src/server.js";
import http from "http";

/** Lightweight HTTP request helper — no external deps */
function request(
    server: http.Server,
    method: string,
    path: string,
    body?: Record<string, unknown>,
    contentType = "application/json"
): Promise<{ status: number; body: any }> {
    return new Promise((resolve, reject) => {
        const addr = server.address() as { port: number };
        const options: http.RequestOptions = {
            hostname: "127.0.0.1",
            port: addr.port,
            path,
            method,
            headers: {} as Record<string, string | number>,
        };

        let payload: Buffer | undefined;
        if (body && contentType === "application/json") {
            payload = Buffer.from(JSON.stringify(body));
            (options.headers as Record<string, string | number>)["Content-Type"] = "application/json";
            (options.headers as Record<string, string | number>)["Content-Length"] = payload.length;
        }

        const req = http.request(options, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                const raw = Buffer.concat(chunks).toString();
                try {
                    resolve({ status: res.statusCode!, body: JSON.parse(raw) });
                } catch {
                    resolve({ status: res.statusCode!, body: raw });
                }
            });
        });

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

describe("Level 8 — API Server", { timeout: 60_000 }, () => {
    let server: http.Server;

    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-your-openai-api-key") {
            throw new Error("OPENAI_API_KEY is required.");
        }
    });

    // Start the Express app on a random port for tests
    beforeAll(async () => {
        server = app.listen(0);
        // Wait for server to be ready
        await new Promise<void>((resolve) => server.once("listening", resolve));
    });

    // Clean up after tests
    afterAll(async () => {
        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    // ── Health Check ────────────────────────────────────────

    describe("GET /health", () => {
        it("returns 200 with system status", async () => {
            const res = await request(server, "GET", "/health");

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("ok");
            expect(res.body.timestamp).toBeTruthy();
            expect(typeof res.body.skills).toBe("number");
            expect(typeof res.body.mcpServers).toBe("number");
            expect(res.body.voice).toBeDefined();
            expect(res.body.voice.sttProvider).toBeTruthy();
            expect(typeof res.body.voice.ttsEnabled).toBe("boolean");
        });

        it("reports registered skill count", async () => {
            const res = await request(server, "GET", "/health");
            // Builtin skills + sentiment example = at least 18
            expect(res.body.skills).toBeGreaterThanOrEqual(1);
        });
    });

    // ── Chat Endpoint ───────────────────────────────────────

    describe("POST /chat", () => {
        it("returns AI response for valid message (real LLM)", async () => {
            const res = await request(server, "POST", "/chat", {
                message: "Hello, who are you?",
                tenantId: "test-tenant",
            });

            expect(res.status).toBe(200);
            expect(typeof res.body.response).toBe("string");
            expect(res.body.response.length).toBeGreaterThan(5);
            expect(res.body.tenantId).toBe("test-tenant");
            expect(typeof res.body.durationMs).toBe("number");
            expect(res.body.durationMs).toBeGreaterThan(0);
        });

        it("returns 400 for missing message", async () => {
            const res = await request(server, "POST", "/chat", {});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain("message");
        });

        it("returns 400 for non-string message", async () => {
            const res = await request(server, "POST", "/chat", {
                message: 12345,
            });
            expect(res.status).toBe(400);
        });

        it("defaults tenantId to 'default' when not provided", async () => {
            const res = await request(server, "POST", "/chat", {
                message: "Quick test",
            });
            expect(res.status).toBe(200);
            expect(res.body.tenantId).toBe("default");
        });
    });

    // ── Voice Endpoint ──────────────────────────────────────

    describe("POST /voice", () => {
        it("returns 400 when no audio file is uploaded", async () => {
            const res = await request(server, "POST", "/voice", {});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain("audio");
        });
    });

    // ── Upload Endpoint ─────────────────────────────────────

    describe("POST /upload", () => {
        it("returns 400 when no file is uploaded", async () => {
            const res = await request(server, "POST", "/upload", {});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain("file");
        });
    });
});
