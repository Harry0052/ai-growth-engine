import fs from "fs";
import path from "path";
import { TABLE_NAMES } from "./constants";

export type SqlRow = Record<string, unknown>;

export type Db = {
  dialect: "sqlite" | "postgres";
  exec(sql: string): Promise<void>;
  all<T = SqlRow>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = SqlRow>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<void>;
};

let singleton: Promise<Db> | null = null;

export function resetDbForTests() {
  singleton = null;
}

function splitSql(sql: string) {
  return sql
    .replace(/--.*$/gm, "")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function toPg(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

async function createSqlite(): Promise<Db> {
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required on Vercel. SQLite is only the local fallback.");
  }
  const { DatabaseSync } = await import("node:sqlite");
  const file = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "growth.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec("PRAGMA journal_mode = WAL");
  return {
    dialect: "sqlite",
    async exec(sql) {
      database.exec(sql);
    },
    async all<T>(sql: string, params: unknown[] = []) {
      const rows = database.prepare(sql).all(...(params as never[]));
      return rows.map((row) => plain<T>(row));
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const row = database.prepare(sql).get(...(params as never[]));
      return row ? plain<T>(row) : null;
    },
    async run(sql, params = []) {
      database.prepare(sql).run(...(params as never[]));
    },
  };
}

async function createPostgres(url: string): Promise<Db> {
  const pg = await import("pg");
  pg.types.setTypeParser(20, (value) => Number(value));
  const pool = new pg.Pool({ connectionString: url });
  return {
    dialect: "postgres",
    async exec(sql) {
      for (const statement of splitSql(sql)) await pool.query(statement);
    },
    async all<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(toPg(sql), params);
      return result.rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(toPg(sql), params);
      return (result.rows[0] as T) ?? null;
    },
    async run(sql, params = []) {
      await pool.query(toPg(sql), params);
    },
  };
}

export async function getDb() {
  if (!singleton) {
    singleton = (async () => {
      const url = process.env.DATABASE_URL || "";
      const database =
        url.startsWith("postgres://") || url.startsWith("postgresql://")
          ? await createPostgres(url)
          : await createSqlite();
      await migrate(database);
      return database;
    })().catch((error) => {
      singleton = null;
      throw error;
    });
  }
  return singleton;
}

export async function migrate(database: Db) {
  const schema = fs.readFileSync(path.join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  if (database.dialect === "sqlite") await database.exec(schema);
  else {
    for (const statement of splitSql(schema)) await database.exec(statement);
  }
  await database.run(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
    ["001_init", Date.now()],
  );
  if (database.dialect === "postgres") {
    try {
      await database.exec("CREATE EXTENSION IF NOT EXISTS vector");
      await database.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [
        "pgvector",
        "available",
      ]);
    } catch {
      await database.run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        ["pgvector", "unavailable"],
      );
    }
  }
}

export async function clearAllForTests() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to wipe a production database.");
  const database = await getDb();
  for (const table of TABLE_NAMES) await database.run(`DELETE FROM ${table}`);
}
