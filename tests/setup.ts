import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// A throwaway data folder per test file – the real ./data is never touched.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motolog-test-"));
process.env.DATA_DIR = dir;
process.env.MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");
process.env.AUTH_MODE = "dev";
delete process.env.OPENAI_API_KEY;
delete (globalThis as { motologDb?: unknown }).motologDb;

afterAll(() => {
  delete (globalThis as { motologDb?: unknown }).motologDb;
  fs.rmSync(dir, { recursive: true, force: true });
});
