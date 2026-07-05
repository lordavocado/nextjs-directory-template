import { createClient as createLibSQLClient } from "@libsql/client"

let _client: ReturnType<typeof createLibSQLClient> | null = null
let _initialized = false

export function getClient() {
  if (!_client) {
    _client = createLibSQLClient({
      url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return _client
}

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  twitter_handle TEXT NOT NULL,
  product_website TEXT NOT NULL,
  codename TEXT NOT NULL UNIQUE,
  punchline TEXT NOT NULL,
  description TEXT NOT NULL,
  logo_src TEXT,
  user_id TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  labels TEXT NOT NULL DEFAULT '[]',
  categories TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_views (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  viewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
`

export async function initDb() {
  if (_initialized) return
  const client = getClient()
  for (const statement of CREATE_TABLES.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(statement)
  }
  _initialized = true
}

export type Product = {
  id: string
  created_at: string
  full_name: string
  email: string
  twitter_handle: string
  product_website: string
  codename: string
  punchline: string
  description: string
  logo_src: string | null
  user_id: string
  tags: string[]
  labels: string[]
  categories: string | null
  view_count: number
  approved: boolean
  featured: boolean
}

export function parseProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    created_at: row.created_at as string,
    full_name: row.full_name as string,
    email: row.email as string,
    twitter_handle: row.twitter_handle as string,
    product_website: row.product_website as string,
    codename: row.codename as string,
    punchline: row.punchline as string,
    description: row.description as string,
    logo_src: (row.logo_src as string | null) ?? null,
    user_id: row.user_id as string,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    labels: row.labels ? JSON.parse(row.labels as string) : [],
    categories: (row.categories as string | null) ?? null,
    view_count: Number(row.view_count ?? 0),
    approved: Boolean(row.approved),
    featured: Boolean(row.featured),
  }
}
