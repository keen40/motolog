import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seed } from "./seed";

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");

type DB = BetterSQLite3Database<typeof schema>;
const globalForDb = globalThis as unknown as { motologDb?: DB };

function open(): DB {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const sqlite = new Database(path.join(/*turbopackIgnore: true*/ DATA_DIR, "motolog.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(/*turbopackIgnore: true*/ process.env.MIGRATIONS_DIR ?? "./drizzle") });
  seed(db);
  return db;
}

/** Lazily opened singleton (survives dev hot reloads). Migrations + seed run on first use. */
export function getDb(): DB {
  return (globalForDb.motologDb ??= open());
}

export { schema };
