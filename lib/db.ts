import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

type Prepared = {
  bind(...values: unknown[]): Prepared;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};

type D1 = {
  prepare(query: string): Prepared;
};

export type Sql = {
  all<T>(query: string, params?: unknown[]): Promise<T[]>;
  get<T>(query: string, params?: unknown[]): Promise<T | null>;
  run(query: string, params?: unknown[]): Promise<void>;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    picture TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    from_lang TEXT NOT NULL,
    to_lang TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    segments TEXT NOT NULL,
    segment_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_translations_user ON translations (user_id, updated_at DESC)`,
];

let ready: Promise<Sql> | null = null;

function adapt(db: D1): Sql {
  return {
    async all<T>(query: string, params: unknown[] = []) {
      const result = await db.prepare(query).bind(...params).all<T>();
      return result.results ?? [];
    },
    async get(query, params = []) {
      return db.prepare(query).bind(...params).first();
    },
    async run(query, params = []) {
      await db.prepare(query).bind(...params).run();
    },
  };
}

async function open(): Promise<Sql> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as { DB?: D1 }).DB;
  if (!db) throw new Error("The D1 database is not bound.");
  const sql = adapt(db);
  for (const statement of SCHEMA) await sql.run(statement);
  return sql;
}

export function database(): Promise<Sql> {
  if (!ready) {
    ready = open().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
