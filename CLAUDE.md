# Project: Cult Admin Directory Template

A Next.js 15 + Supabase (auth/storage) + Turso (database) product directory. Users browse, search, filter, and submit tools/SaaS products. The stack is Next.js App Router, Supabase (auth + storage), Turso/LibSQL (database), Tailwind CSS, shadcn/ui, framer-motion.

---

## Architecture

### Routes

| Path | Type | Purpose |
|---|---|---|
| `/` | Server | Home: hero, search, featured grid |
| `/products` | Server (dynamic) | Full catalog with sidebar filters |
| `/products/[slug]` | Server (dynamic) | Product detail page (slug = product UUID) |
| `/submit` | Server | Submit form — requires auth, redirects to `/login` if not logged in |
| `/login` | Server | Email/password login + sign-up tabs |
| `/login/password` | Client | Change-password page (reached via email reset link) |
| `/auth/callback` | Route handler | Supabase auth code exchange |

### Key Files

- `app/actions/product.ts` — `getProducts`, `getProductById`, `incrementClickCount` (server actions, uses Turso)
- `app/actions/cached_actions.ts` — `getCachedFilters` (uses `unstable_cache`, reads `categories`/`labels`/`tags` from Turso)
- `app/submit/action.ts` — `onSubmitToolAction` form action: validates → uploads logo (Supabase storage) → inserts product (Turso)
- `app/submit/prompt.ts` — `getAIEnrichmentPrompt` exported function for Claude enrichment
- `app/submit/schema.ts` — Zod schemas: `schema` (form), `enrichmentSchema` (AI output)
- `db/turso/client.ts` — Turso/LibSQL client singleton, `initDb()` (creates tables on first run), `parseProduct()` helper
- `db/supabase/server.ts` — SSR Supabase client (used for auth + storage only)
- `db/supabase/client.ts` — Browser Supabase client
- `db/supabase/middleware.ts` — Session refresh in middleware
- `middleware.ts` — Calls `updateSession` to keep auth fresh
- `components/nav.tsx` — `NavSidebar` with category/tag/label filters + `LogoAnimationLink`
- `components/directory-card-grid.tsx` — `ResourceCardGrid`, `FeaturedGrid`, `EmptyFeaturedGrid`
- `components/directory-product-card.tsx` — Individual product card
- `hooks/use-resource-click-counter.tsx` — Client hook calling `increment_product_view_count` RPC (Supabase, legacy — not used by main flow)

---

## Database Split

| Concern | Provider |
|---|---|
| Product data | Turso (LibSQL/SQLite) |
| Categories/Labels/Tags | Turso (LibSQL/SQLite) |
| Authentication | Supabase Auth |
| Logo file storage | Supabase Storage (`product-logos` bucket) |

### Turso Schema (SQLite)

Tables created automatically by `initDb()` in `db/turso/client.ts`:
- **`products`** — `id TEXT PK`, `codename TEXT UNIQUE`, `tags TEXT` (JSON array), `labels TEXT` (JSON array), `categories TEXT`, `view_count INTEGER`, `approved INTEGER`, `featured INTEGER`, etc.
- **`product_views`** — audit log (currently unused by main flow)
- **`categories` / `labels` / `tags`** — lookup tables, `name TEXT UNIQUE`

Arrays (`tags`, `labels`) are stored as JSON strings and parsed by `parseProduct()`.

### Filtering with JSON arrays

```sql
-- Filter by label
WHERE EXISTS (SELECT 1 FROM json_each(labels) WHERE value = ?)
-- Filter by tag
WHERE EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
```

### Environment Variables

```
TURSO_DATABASE_URL=libsql://your-db.turso.io   # or file:local.db for dev
TURSO_AUTH_TOKEN=your-token                     # not required for file: URLs
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Data Flows

### Browse / Filter
1. Page calls `getProducts(search, category, label, tag)` (server action, React cache, Turso SQL)
2. Filters loaded via `getCachedFilters()` (`unstable_cache`, 9000s TTL, reads lookup tables from Turso)
3. `NavSidebar` receives filter arrays as props, renders links with URL search params
4. Clicking a filter navigates to `/products?category=X` etc.

### View Count
- `DirectoryProductCard` calls `incrementClickCount(id)` server action on click
- Server action does `UPDATE products SET view_count = view_count + 1 WHERE id = ?` in Turso

### Submit
1. User must be authenticated (redirected to `/login` if not) — Supabase auth
2. `onSubmitToolAction` validates via Zod, uploads logo to Supabase `product-logos` bucket
3. If `config.aiEnrichmentEnabled = true`, calls Claude Haiku to generate tags/labels
4. Inserts new category/label/tag into Turso lookup tables via `INSERT OR IGNORE`
5. Inserts product into Turso `products` table with `approved = 1`
6. Revalidates `/` (layout) and `/products` (page)

### Auth
- Email/password only (Supabase). Sign-up auto-signs-in (no email confirmation).
- `middleware.ts` refreshes sessions on every request via `updateSession`.

---

## Compatibility Notes (Next.js 15)

- `headers()`, `cookies()` are now async — must be awaited
- `searchParams` and `params` in page/layout props are now `Promise<T>` — must be awaited
- `revalidatePath` requires a second argument: `"page"` or `"layout"`
- `isRedirectError` moved to `next/dist/client/components/redirect-error`

## Dependency Constraints

- React pinned to `^18.3.1` (not `latest`) — lucide-react 0.378 does not support React 19
- `@ai-sdk/anthropic` and `@ai-sdk/openai` pinned to `^0.0.39` to match `ai@3.x` internals

---

## Config Flags (`app/submit/action.ts`)

```ts
const config = {
  aiEnrichmentEnabled: false,   // set true to auto-tag with Claude Haiku
  aiModel: anthropic("claude-3-haiku-20240307"),
  storageBucket: "product-logos",
  allowNewTags: true,
  allowNewLabels: true,
  allowNewCategories: true,
}
```

## Featured Products

In `app/page.tsx`, populate `FEATURED_IDS` with product UUIDs to feature them in the hero grid:

```ts
const FEATURED_IDS = ["uuid-1", "uuid-2"]
```

---

## Admin

`NavSidebar` shows an admin section when `pathname.includes("admin")`. Admin routes (`/admin`, `/admin/products`, `/admin/users`, `/admin/filters`) are **not implemented** — navigating there will 404. Implement as needed.


---

## Architecture

### Routes

| Path | Type | Purpose |
|---|---|---|
| `/` | Server | Home: hero, search, featured grid |
| `/products` | Server (dynamic) | Full catalog with sidebar filters |
| `/products/[slug]` | Server (dynamic) | Product detail page (slug = product UUID) |
| `/submit` | Server | Submit form — requires auth, redirects to `/login` if not logged in |
| `/login` | Server | Email/password login + sign-up tabs |
| `/login/password` | Client | Change-password page (reached via email reset link) |
| `/auth/callback` | Route handler | Supabase auth code exchange |

### Key Files

- `app/actions/product.ts` — `getProducts`, `getProductById`, `incrementClickCount` (server actions, uses SSR Supabase client)
- `app/actions/cached_actions.ts` — `getCachedFilters` (uses `unstable_cache`, reads `categories`/`labels`/`tags` tables)
- `app/submit/action.ts` — `onSubmitToolAction` form action: validates → uploads logo → (optionally AI-enriches) → inserts product
- `app/submit/prompt.ts` — `getAIEnrichmentPrompt` exported function for Claude enrichment
- `app/submit/schema.ts` — Zod schemas: `schema` (form), `enrichmentSchema` (AI output)
- `db/supabase/server.ts` — SSR Supabase client (cookies async-aware for Next.js 15)
- `db/supabase/client.ts` — Browser Supabase client
- `db/supabase/middleware.ts` — Session refresh in middleware
- `middleware.ts` — Calls `updateSession` to keep auth fresh
- `components/nav.tsx` — `NavSidebar` with category/tag/label filters + `LogoAnimationLink`
- `components/directory-card-grid.tsx` — `ResourceCardGrid`, `FeaturedGrid`, `EmptyFeaturedGrid`
- `components/directory-product-card.tsx` — Individual product card
- `hooks/use-resource-click-counter.tsx` — Client hook calling `increment_product_view_count` RPC

---

## Database (Supabase)

### Tables

**`products`**
- `id uuid PK`, `codename text UNIQUE`, `full_name`, `email`, `twitter_handle`, `product_website`, `punchline`, `description`, `logo_src`, `user_id uuid → auth.users`, `tags text[]`, `labels text[]`, `categories text`, `view_count int`, `approved bool`, `featured bool`
- RLS: public SELECT via `USING (true)`, authenticated CRUD via `auth.uid() = user_id`

**`product_views`** — audit log, `product_id → products.id`. A trigger on insert updates `products.view_count`.

**`categories` / `labels` / `tags`** — lookup tables (`id`, `name UNIQUE`). RLS: public SELECT, authenticated INSERT.

**`product-logos`** — Supabase Storage bucket (public). RLS on `storage.objects`: public SELECT, authenticated INSERT/UPDATE/DELETE.

### Functions

`increment_product_view_count(product_id UUID)` — SECURITY DEFINER, increments `view_count` directly. Granted EXECUTE to `authenticated` and `anon`.

---

## Data Flows

### Browse / Filter
1. Page calls `getProducts(search, category, label, tag)` (server action, React cache)
2. Filters loaded via `getCachedFilters()` (`unstable_cache`, 9000s TTL, reads lookup tables)
3. `NavSidebar` receives filter arrays as props, renders links with URL search params
4. Clicking a filter navigates to `/products?category=X` etc.

### View Count
- `DirectoryProductCard` calls `incrementClickCount(id)` server action on click
- Server action calls Supabase RPC `increment_product_view_count`
- Client hook `useResourceCounter` (unused by main flow but available) also targets the same RPC

### Submit
1. User must be authenticated (redirected to `/login` if not)
2. `onSubmitToolAction` validates via Zod, uploads logo to `product-logos` bucket
3. If `config.aiEnrichmentEnabled = true`, calls Claude Haiku to generate tags/labels
4. Inserts new category/label/tag into lookup tables if not already present
5. Inserts product with `approved: true`
6. Revalidates `/` (layout) and `/products` (page)

### Auth
- Email/password only. Sign-up auto-signs-in (no email confirmation).
- `middleware.ts` refreshes sessions on every request via `updateSession`.
- Password reset sends email → user lands at `/login/password` → `ChangePassword` component.

---

## Compatibility Notes (Next.js 15)

- `headers()`, `cookies()` are now async — must be awaited
- `searchParams` and `params` in page/layout props are now `Promise<T>` — must be awaited
- `revalidatePath` requires a second argument: `"page"` or `"layout"`
- `isRedirectError` moved to `next/dist/client/components/redirect-error`

## Dependency Constraints

- React pinned to `^18.3.1` (not `latest`) — lucide-react 0.378 does not support React 19
- `@ai-sdk/anthropic` and `@ai-sdk/openai` pinned to `^0.0.39` to match `ai@3.x` internals

---

## Config Flags (`app/submit/action.ts`)

```ts
const config = {
  aiEnrichmentEnabled: false,   // set true to auto-tag with Claude Haiku
  aiModel: anthropic("claude-3-haiku-20240307"),
  storageBucket: "product-logos",
  allowNewTags: true,
  allowNewLabels: true,
  allowNewCategories: true,
}
```

## Featured Products

In `app/page.tsx`, populate `FEATURED_IDS` with product UUIDs to feature them in the hero grid:

```ts
const FEATURED_IDS = ["uuid-1", "uuid-2"]
```

---

## Admin

`NavSidebar` shows an admin section when `pathname.includes("admin")`. Admin routes (`/admin`, `/admin/products`, `/admin/users`, `/admin/filters`) are **not implemented** — navigating there will 404. Implement as needed.
