import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { assertTestDatabaseIsolation } from "@/lib/test-database-isolation";

// Supports local SQLite (dev) and Turso/libSQL (production).
// Set DATABASE_URL to a Turso URL to use Turso in production.
// Leave DATABASE_URL unset to use SQLite locally at ./local.db.

function createDb() {
  assertTestDatabaseIsolation();
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl?.startsWith("libsql://") || databaseUrl?.startsWith("https://")) {
    // Turso/libSQL path — imported dynamically to avoid requiring the package in dev
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/libsql");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    const client = createClient({
      url: databaseUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    return drizzle(client, { schema });
  }

  // Local SQLite
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const sqlite = new Database(process.env.DB_FILE_NAME ?? "local.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzleSqlite(sqlite, { schema });
}

export const db = createDb();
export type DB = typeof db;
