import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Default timeout for unit tests (5s)
        testTimeout: 5000,
        // Load .env from monorepo root (shared across workspaces)
        setupFiles: ["./setup-env.ts"],
        // Run tests in sequence to avoid rate limits on live tests
        sequence: {
            concurrent: false,
        },
    },
});
