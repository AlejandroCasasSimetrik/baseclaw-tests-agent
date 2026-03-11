/**
 * Load .env from monorepo root so all workspaces share the same env vars.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Disable LangSmith tracing during tests to prevent 403 errors
// (org-scoped key requires LANGSMITH_WORKSPACE_ID which interferes with tests)
process.env.LANGCHAIN_TRACING_V2 = "false";
