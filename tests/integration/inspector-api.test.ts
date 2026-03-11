/**
 * Inspector API — Integration Tests
 *
 * Tests the Inspector REST and SSE endpoints against the real server.
 * Uses the same pattern as level8-server.test.ts — starts the app
 * on a random port, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "baseclaw-agent/src/server.js";
import http from "http";

/** Lightweight HTTP request helper */
function request(
    server: http.Server,
    method: string,
    path: string,
): Promise<{ status: number; body: any }> {
    return new Promise((resolve, reject) => {
        const addr = server.address() as { port: number };
        const options: http.RequestOptions = {
            hostname: "127.0.0.1",
            port: addr.port,
            path,
            method,
            headers: {},
        };

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
        req.end();
    });
}

describe("Inspector API", { timeout: 30_000 }, () => {
    let server: http.Server;

    beforeAll(async () => {
        server = app.listen(0);
        await new Promise<void>((resolve) => server.once("listening", resolve));
    });

    afterAll(async () => {
        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    // ── Dev Console Gate ────────────────────────────────────

    describe("Dev console gate", () => {
        it("returns data when ENABLE_DEV_CONSOLE=true", async () => {
            // Our .env sets ENABLE_DEV_CONSOLE=true
            const res = await request(server, "GET", "/api/skills/registry");
            // Should be 200 (enabled) or 403 (disabled), depending on env
            if (process.env.ENABLE_DEV_CONSOLE === "true") {
                expect(res.status).toBe(200);
            } else {
                expect(res.status).toBe(403);
            }
        });
    });

    // ── Skills API ──────────────────────────────────────────

    describe("GET /api/skills/registry", () => {
        it("returns list of registered skills", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/skills/registry");
            expect(res.status).toBe(200);
            expect(res.body.skills).toBeDefined();
            expect(Array.isArray(res.body.skills)).toBe(true);
            expect(res.body.count).toBeGreaterThanOrEqual(1);

            // Verify skill shape
            const skill = res.body.skills[0];
            expect(skill.id).toBeTruthy();
            expect(skill.name).toBeTruthy();
            expect(skill.description).toBeTruthy();
            expect(Array.isArray(skill.agentTypes)).toBe(true);
            expect(typeof skill.isBuiltIn).toBe("boolean");
        });

        it("does NOT expose handler or relevanceScorer in response", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/skills/registry");
            // Verify no skill has handler or relevanceScorer properties
            for (const skill of res.body.skills) {
                expect(skill).not.toHaveProperty("handler");
                expect(skill).not.toHaveProperty("relevanceScorer");
                expect(skill).not.toHaveProperty("systemPromptFragment");
            }
        });
    });

    describe("GET /api/skills/loaded/:agentType", () => {
        it("returns skills for ideation agent", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/skills/loaded/ideation");
            expect(res.status).toBe(200);
            expect(res.body.agentType).toBe("ideation");
            expect(Array.isArray(res.body.skills)).toBe(true);
        });

        it("returns 400 for invalid agent type", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/skills/loaded/invalid");
            expect(res.status).toBe(400);
        });
    });

    // ── MCP API ─────────────────────────────────────────────

    describe("GET /api/mcp/registry", () => {
        it("returns list of MCP servers", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/mcp/registry");
            expect(res.status).toBe(200);
            expect(res.body.servers).toBeDefined();
            expect(Array.isArray(res.body.servers)).toBe(true);
        });

        it("sanitizes MCP config — no authConfig values", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/mcp/registry");
            const raw = JSON.stringify(res.body);
            expect(raw).not.toContain("authConfig");
        });
    });

    describe("GET /api/mcp/attached/:agentType", () => {
        it("returns servers for execution agent", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/mcp/attached/execution");
            expect(res.status).toBe(200);
            expect(res.body.agentType).toBe("execution");
            expect(Array.isArray(res.body.servers)).toBe(true);
        });

        it("returns 400 for invalid agent type", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/mcp/attached/bogus");
            expect(res.status).toBe(400);
        });
    });

    describe("GET /api/mcp/tools/:serverId", () => {
        it("returns 404 for unknown server", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const res = await request(server, "GET", "/api/mcp/tools/nonexistent");
            expect(res.status).toBe(404);
        });

        it("returns server info for known server", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            // Get the first server ID
            const regRes = await request(server, "GET", "/api/mcp/registry");
            if (regRes.body.servers.length === 0) return;

            const serverId = regRes.body.servers[0].id;
            const res = await request(server, "GET", `/api/mcp/tools/${serverId}`);
            expect(res.status).toBe(200);
            expect(res.body.serverId).toBe(serverId);
            expect(res.body.serverName).toBeTruthy();
        });
    });

    // ── SSE Endpoints ──────────────────────────────────────

    describe("SSE /api/skills/events", () => {
        it("establishes connection and receives initial heartbeat", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const addr = server.address() as { port: number };
            const data = await new Promise<string>((resolve, reject) => {
                const req = http.get(
                    `http://127.0.0.1:${addr.port}/api/skills/events`,
                    (res) => {
                        let data = "";
                        res.on("data", (chunk) => {
                            data += chunk.toString();
                            // Close after first event
                            if (data.includes("connected")) {
                                req.destroy();
                                resolve(data);
                            }
                        });
                    }
                );
                req.on("error", (err) => {
                    // Expected — we destroy the request
                    if (data.includes("connected")) resolve(data);
                    else reject(err);
                });
                // Timeout
                setTimeout(() => {
                    req.destroy();
                    reject(new Error("SSE timeout"));
                }, 5000);
            });

            expect(data).toContain("event: connected");
            expect(data).toContain("status");
        });
    });

    describe("SSE /api/mcp/events", () => {
        it("establishes connection and receives initial heartbeat", async () => {
            if (process.env.ENABLE_DEV_CONSOLE !== "true") return;

            const addr = server.address() as { port: number };
            const data = await new Promise<string>((resolve, reject) => {
                const req = http.get(
                    `http://127.0.0.1:${addr.port}/api/mcp/events`,
                    (res) => {
                        let data = "";
                        res.on("data", (chunk) => {
                            data += chunk.toString();
                            if (data.includes("connected")) {
                                req.destroy();
                                resolve(data);
                            }
                        });
                    }
                );
                req.on("error", (err) => {
                    if (data.includes("connected")) resolve(data);
                    else reject(err);
                });
                setTimeout(() => {
                    req.destroy();
                    reject(new Error("SSE timeout"));
                }, 5000);
            });

            expect(data).toContain("event: connected");
        });
    });
});
