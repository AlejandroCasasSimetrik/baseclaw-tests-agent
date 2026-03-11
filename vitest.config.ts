import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Default timeout for unit tests (5s)
        testTimeout: 5000,
        // Load .env for tests that need API keys
        setupFiles: ["dotenv/config"],
        // Run tests in sequence to avoid rate limits on live tests
        sequence: {
            concurrent: false,
        },
    },
});
