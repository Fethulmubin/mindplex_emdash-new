# Mindplex → EmDash Plugin Architecture

> **Auth plugin only** (Posts and Users added separately).
> Built as a **native EmDash plugin** using the real EmDash plugin API from
> [github.com/emdash-cms/emdash](https://github.com/emdash-cms/emdash).
> Database: **PostgreSQL via EmDash's built-in Kysely ORM** (`ctx.db`).

---

## 0. Migration Philosophy

| Mindplex (Bun + Hono) | EmDash Plugin |
|---|---|
| Hono route handlers | `routes:` map in `sandbox-entry.ts` — each key is a named route |
| Separate handler files | All handlers in `routes.ts`, all schemas in `schemas.ts` |
| `guard()` RBAC middleware | Manual session check per handler via `ctx.users` or KV |
| Drizzle ORM + pg | **EmDash built-in Kysely ORM** — Postgres via `@astrojs/node` adapter |
| JWT session model | `jose` HS256 — secret from `ctx.kv.get("settings:jwtSecret")` |
| Redis KV cache | `ctx.kv` — plugin-scoped key/value, always available |
| Valibot validators | Zod schemas in `schemas.ts` (EmDash routes validate with Zod) |
| Hono sub-routers | `routes:` map — each key becomes `/_emdash/api/plugins/<id>/<key>` |

**Key architectural rules from the real EmDash docs:**

1. **Two entrypoints, two contexts.** The **descriptor** (`src/index.ts`) runs at build time
   inside Vite — side-effect-free, declares metadata and storage only. The **plugin definition**
   (`src/sandbox-entry.ts`) runs at request time and contains all hooks and route logic.

2. **Native format** is used here because:
   - Direct Postgres/Kysely access (`ctx.db`) is required for complex auth queries.
   - `lib/` utilities (argon2, jose) need Node.js built-ins — incompatible with sandboxed V8 isolates.
   - Native plugins run in-process. They cannot be sandboxed or marketplace-published.

3. **Routes are named keys**, not `ctx.router.post()` calls. Each key in `routes:` becomes
   `/_emdash/api/plugins/mindplex-auth/<key>`. Input is validated with a Zod schema;
   invalid input auto-returns 400.

4. **`storage:`** is declared in the **descriptor** (`index.ts`), not in `definePlugin()`.
   For raw SQL against Postgres, use `ctx.db` (Kysely) — available in native plugins.

5. **Postgres** is configured once in `astro.config.mjs`. All plugins share the same
   Kysely instance via `ctx.db`. EmDash uses Kysely internally and exposes it to native plugins.

---

## 1. Package Structure

```
mindplex-cms/
  astro.config.mjs            Astro + EmDash integration (Postgres adapter)
  package.json
  tsconfig.json

  src/
    plugins/
      auth/
        index.ts              Descriptor factory — id, version, capabilities, storage
        sandbox-entry.ts      definePlugin({ hooks, routes }) — entry point
        routes.ts             All 6 handler functions
        schemas.ts            All 5 Zod schemas + TypeScript types
        lib/
          jwt.ts              issueTokenPair · verifyAccessToken
          password.ts         hashPassword · migrateIfLegacyHash
          token.ts            generateActivationToken

      posts/                  (to be added later)
      users/                  (to be added later)

    shared/
      errors.ts               Error helpers + isUniqueViolation
      types.ts                Role · SessionUser

  scripts/
    migrate.sql               Postgres schema for plugin-owned tables

  __tests__/
    auth.test.ts
```

### `astro.config.mjs` — Postgres + Plugin registration

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import node             from "@astrojs/node";
import emdash           from "emdash/astro";
import { authPlugin }   from "./src/plugins/auth/index.ts";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),

  integrations: [
    emdash({
      database: {
        // EmDash uses Kysely internally; this adapter targets Postgres on Node.js
        type:             "postgres",
        connectionString: process.env.DATABASE_URL,
        ssl:              process.env.DB_USE_SSL === "true",
      },
      plugins: [authPlugin()],   // native plugins — not sandboxed:
    }),
  ],
});
```

### `package.json`

```json
{
  "name": "mindplex-cms",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "astro":         "^4.0.0",
    "@astrojs/node": "^8.0.0",
    "emdash":        "latest",
    "jose":          "^5.0.0",
    "zod":           "^3.22.0",
    "argon2":        "^0.31.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  }
}
```

---

## 2. Auth Plugin

### 2.1 Descriptor (`src/plugins/auth/index.ts`)

Runs at **build time inside Vite**. Declares id, version, format, capabilities, storage.
No side effects, no jose/argon2 imports here.

```ts
// src/plugins/auth/index.ts
import type { PluginDescriptor } from "emdash";

export function authPlugin(): PluginDescriptor {
  return {
    id:          "mindplex-auth",
    version:     "1.0.0",
    format:      "native",
    entrypoint:  "./src/plugins/auth/sandbox-entry.ts",
    options:     {},

    capabilities: [
      "read:users",    // ctx.users.get / list / getByEmail
      "email:send",    // ctx.email.send()
      "network:fetch", // ctx.http.fetch() — Google OAuth token verification
    ],

    allowedHosts: ["oauth2.googleapis.com", "www.googleapis.com"],

    // EmDash document-store collections (indexed queries via ctx.storage).
    // Refresh tokens and activation tokens use Postgres directly via ctx.db (Kysely)
    // for expiry filtering and family-based bulk deletes.
    storage: {},

    adminPages: [
      { path: "/auth", label: "Auth", icon: "lock" },
    ],
  };
}
```

### 2.2 Schemas (`src/plugins/auth/schemas.ts`)

All Zod schemas in one file. EmDash route `input:` fields accept Zod schemas.

```ts
// src/plugins/auth/schemas.ts
import { z } from "astro/zod";

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3),
});

export const ActivateSchema = z.object({
  token: z.string().min(1),
});

export const SocialSchema = z.object({
  idToken:  z.string().min(1),
  provider: z.literal("google"),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput    = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ActivateInput = z.infer<typeof ActivateSchema>;
export type SocialInput   = z.infer<typeof SocialSchema>;
export type RefreshInput  = z.infer<typeof RefreshSchema>;
```

### 2.3 Route Handlers (`src/plugins/auth/routes.ts`)

All handler logic in one file. Each function is imported by `sandbox-entry.ts` and mapped
to a route key. `ctx.db` is Kysely targeting Postgres.

```ts
// src/plugins/auth/routes.ts
import type { PluginContext } from "emdash";
import { hashPassword, migrateIfLegacyHash } from "./lib/password";
import { issueTokenPair }                    from "./lib/jwt";
import { generateActivationToken }           from "./lib/token";
import { isUniqueViolation }                 from "@shared/errors";

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(ctx: PluginContext & { input: { email: string; password: string } }) {
  const { email, password } = ctx.input;

  const user = await ctx.db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", email)
    .executeTakeFirst();

  if (!user) return { error: "Invalid credentials", status: 401 };

  const { valid, migrated, newHash } = await migrateIfLegacyHash(password, user.password_hash);
  if (!valid) return { error: "Invalid credentials", status: 401 };

  if (migrated && newHash) {
    await ctx.db
      .updateTable("users")
      .set({ password_hash: newHash })
      .where("id", "=", user.id)
      .execute();
  }

  const jwtSecret = (await ctx.kv.get<string>("settings:jwtSecret")) ?? "";
  const tokens = await issueTokenPair(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret
  );

  await ctx.db.insertInto("refresh_tokens").values({
    token_hash: tokens.tokenHash,
    user_id:    user.id,
    family_id:  tokens.familyId,
    session_id: tokens.sessionId,
    expires_at: tokens.expiresAt,
  }).execute();

  return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(ctx: PluginContext & {
  input: { email: string; password: string; username: string };
}) {
  const { email, password, username } = ctx.input;
  const passwordHash = await hashPassword(password);

  try {
    const user = await ctx.db
      .insertInto("users")
      .values({ email, username, password_hash: passwordHash, role: "user", is_active: false })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await ctx.db.insertInto("user_profiles").values({ user_id: user.id }).execute();
    await ctx.db.insertInto("user_preferences").values({ user_id: user.id }).execute();
    await ctx.db.insertInto("user_notification_settings").values({ user_id: user.id }).execute();

    const token     = generateActivationToken();
    const expiresAt = new Date(Date.now() + 86_400_000); // 24 hr

    await ctx.db.insertInto("activation_tokens")
      .values({ token, user_id: user.id, expires_at: expiresAt })
      .execute();

    await ctx.email.send({
      to:      email,
      subject: "Activate your Mindplex account",
      html:    `<a href="/activate?token=${token}">Activate account</a>`,
    });

    return { data: { id: user.id }, status: 201 };
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Email or username already taken", status: 409 };
    throw err;
  }
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export async function activate(ctx: PluginContext & { input: { token: string } }) {
  const record = await ctx.db
    .selectFrom("activation_tokens")
    .selectAll()
    .where("token",      "=",  ctx.input.token)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();

  if (!record) return { error: "Invalid or expired token", status: 400 };

  await ctx.db
    .updateTable("users")
    .set({ is_active: true })
    .where("id", "=", record.user_id)
    .execute();

  await ctx.db.deleteFrom("activation_tokens").where("id", "=", record.id).execute();

  return { data: { ok: true } };
}

// ─── Social (Google) ──────────────────────────────────────────────────────────

export async function social(ctx: PluginContext & {
  input: { idToken: string; provider: "google" };
}) {
  const gRes  = await ctx.http!.fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${ctx.input.idToken}`
  );
  const gData = await gRes.json() as { email?: string; error?: string };

  if (!gRes.ok || !gData.email) return { error: "Invalid Google token", status: 401 };

  let user = await ctx.db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", gData.email)
    .executeTakeFirst();

  if (!user) {
    const username = gData.email.split("@")[0] + "_" + Math.random().toString(36).slice(2, 6);
    user = await ctx.db
      .insertInto("users")
      .values({ email: gData.email, username, password_hash: "", role: "user", is_active: true })
      .returningAll()
      .executeTakeFirstOrThrow();

    await ctx.db.insertInto("user_profiles").values({ user_id: user.id }).execute();
    await ctx.db.insertInto("user_preferences").values({ user_id: user.id }).execute();
    await ctx.db.insertInto("user_notification_settings").values({ user_id: user.id }).execute();
  }

  const jwtSecret = (await ctx.kv.get<string>("settings:jwtSecret")) ?? "";
  const tokens = await issueTokenPair(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret
  );

  await ctx.db.insertInto("refresh_tokens").values({
    token_hash: tokens.tokenHash,
    user_id:    user.id,
    family_id:  tokens.familyId,
    session_id: tokens.sessionId,
    expires_at: tokens.expiresAt,
  }).execute();

  return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export async function refresh(ctx: PluginContext & { input: { refreshToken: string } }) {
  const rawToken = ctx.input.refreshToken;
  const hashBuf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  const hash     = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));

  const token = await ctx.db
    .selectFrom("refresh_tokens")
    .selectAll()
    .where("token_hash", "=",  hash)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();

  if (!token) return { error: "Invalid or expired token", status: 401 };

  // Rotate — revoke old token, issue new one
  await ctx.db.deleteFrom("refresh_tokens").where("id", "=", token.id).execute();

  const user = await ctx.db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", token.user_id)
    .executeTakeFirst();

  if (!user) return { error: "User not found", status: 401 };

  const jwtSecret = (await ctx.kv.get<string>("settings:jwtSecret")) ?? "";
  const tokens = await issueTokenPair(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret
  );

  await ctx.db.insertInto("refresh_tokens").values({
    token_hash: tokens.tokenHash,
    user_id:    user.id,
    family_id:  tokens.familyId,
    session_id: tokens.sessionId,
    expires_at: tokens.expiresAt,
  }).execute();

  return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(ctx: PluginContext) {
  const body = await ctx.request.json().catch(() => ({})) as { refreshToken?: string };

  if (body?.refreshToken) {
    const hashBuf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(body.refreshToken)
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));

    const token = await ctx.db
      .selectFrom("refresh_tokens")
      .select(["family_id"])
      .where("token_hash", "=", hash)
      .executeTakeFirst();

    if (token) {
      // Revoke entire refresh token family (all sessions for this device lineage)
      await ctx.db
        .deleteFrom("refresh_tokens")
        .where("family_id", "=", token.family_id)
        .execute();
    }
  }

  return { data: { ok: true } };
}
```

### 2.4 Plugin Definition (`src/plugins/auth/sandbox-entry.ts`)

Runs at **request time** on the deployed server. Wires route handlers and lifecycle hooks.

```ts
// src/plugins/auth/sandbox-entry.ts
import { definePlugin }      from "emdash";
import type { PluginContext } from "emdash";
import { login, register, activate, social, refresh, logout } from "./routes";
import {
  LoginSchema, RegisterSchema, ActivateSchema,
  SocialSchema, RefreshSchema,
} from "./schemas";

export default definePlugin({
  // id / version / capabilities live in the descriptor (index.ts) for native plugins.
  // definePlugin() here provides type inference and hook/route registration only.

  hooks: {
    "plugin:install": {
      handler: async (_event: any, ctx: PluginContext) => {
        // Auto-generate JWT secret on first install if not set
        const existing = await ctx.kv.get("settings:jwtSecret");
        if (!existing) {
          const secret = btoa(
            String.fromCharCode(...crypto.getRandomValues(new Uint8Array(48)))
          );
          await ctx.kv.set("settings:jwtSecret", secret);
          ctx.log.info("mindplex-auth: generated JWT secret");
        }
      },
    },
  },

  routes: {
    // POST /_emdash/api/plugins/mindplex-auth/login
    login: {
      input:   LoginSchema,
      handler: async (ctx: any) => login(ctx),
    },

    // POST /_emdash/api/plugins/mindplex-auth/register
    register: {
      input:   RegisterSchema,
      handler: async (ctx: any) => register(ctx),
    },

    // POST /_emdash/api/plugins/mindplex-auth/activate
    activate: {
      input:   ActivateSchema,
      handler: async (ctx: any) => activate(ctx),
    },

    // POST /_emdash/api/plugins/mindplex-auth/social
    social: {
      input:   SocialSchema,
      handler: async (ctx: any) => social(ctx),
    },

    // POST /_emdash/api/plugins/mindplex-auth/refresh
    refresh: {
      input:   RefreshSchema,
      handler: async (ctx: any) => refresh(ctx),
    },

    // POST /_emdash/api/plugins/mindplex-auth/logout
    logout: {
      handler: async (ctx: any) => logout(ctx),
    },
  },
});
```

### 2.5 Auth Libraries (`lib/`)

```ts
// src/plugins/auth/lib/jwt.ts
import { SignJWT, jwtVerify } from "jose";

const ISSUER              = "mindplex";
const AUDIENCE            = "mindplex-api";
const ACCESS_TTL          = "15m";
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function issueTokenPair(
  payload:   { sub: string; email: string; role: string },
  jwtSecret: string
) {
  const secret    = new TextEncoder().encode(jwtSecret);
  const sessionId = crypto.randomUUID();
  const familyId  = crypto.randomUUID();

  const accessToken = await new SignJWT({ ...payload, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);

  const rawRefresh = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(48))));
  const hashBuf    = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawRefresh));
  const tokenHash  = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));
  const expiresAt  = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  return { accessToken, refreshToken: rawRefresh, tokenHash, familyId, sessionId, expiresAt };
}

export async function verifyAccessToken(token: string, jwtSecret: string) {
  const secret = new TextEncoder().encode(jwtSecret);
  return jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
}
```

```ts
// src/plugins/auth/lib/password.ts
import argon2 from "argon2";

export const hashPassword = (plain: string) =>
  argon2.hash(plain, { type: argon2.argon2id });

export async function migrateIfLegacyHash(
  plain:  string,
  stored: string
): Promise<{ valid: boolean; migrated: boolean; newHash?: string }> {
  if (stored.startsWith("$argon2")) {
    return { valid: await argon2.verify(stored, plain), migrated: false };
  }
  // Replace with your actual legacy hash check (e.g. bcrypt)
  const valid = stored === plain;
  if (!valid) return { valid: false, migrated: false };
  return { valid: true, migrated: true, newHash: await hashPassword(plain) };
}
```

```ts
// src/plugins/auth/lib/token.ts
export const generateActivationToken = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
```

---

## 3. Shared Utilities (`src/shared/`)

```ts
// src/shared/errors.ts
export const conflict   = (msg = "Conflict")    => ({ error: msg, status: 409 });
export const badRequest = (msg = "Bad request") => ({ error: msg, status: 400 });
export const notFound   = (msg = "Not found")   => ({ error: msg, status: 404 });

// Postgres error code 23505 — unique_violation
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error &&
    ((err as any).code === "23505" || err.message.toLowerCase().includes("unique"))
  );
}
```

```ts
// src/shared/types.ts
export type Role = "user" | "collaborator" | "editor" | "moderator" | "admin";

export interface SessionUser {
  id:    string;
  email: string;
  role:  Role;
}
```

---

## 4. Postgres Schema (`scripts/migrate.sql`)

EmDash manages its own core tables. These are **plugin-owned tables** for Mindplex auth data.
Run once via `psql $DATABASE_URL < scripts/migrate.sql` or any Postgres migration tool.

```sql
-- Plugin-owned Postgres tables for mindplex-auth

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(32)  NOT NULL DEFAULT 'user',
  is_active     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(128),
  bio          TEXT,
  avatar_url   TEXT,
  website_url  TEXT,
  location     VARCHAR(128),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notification_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT        NOT NULL UNIQUE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id  UUID        NOT NULL,
  session_id UUID        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activation_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT        NOT NULL UNIQUE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash      ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family    ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_token  ON activation_tokens (token);
```

---

## 5. Route Map

All routes are POST. Input is validated by the Zod schema declared on the route.
Invalid input returns `400` automatically.

| Route key | URL | Zod schema |
|---|---|---|
| `login` | `/_emdash/api/plugins/mindplex-auth/login` | `LoginSchema` |
| `register` | `/_emdash/api/plugins/mindplex-auth/register` | `RegisterSchema` |
| `activate` | `/_emdash/api/plugins/mindplex-auth/activate` | `ActivateSchema` |
| `social` | `/_emdash/api/plugins/mindplex-auth/social` | `SocialSchema` |
| `refresh` | `/_emdash/api/plugins/mindplex-auth/refresh` | `RefreshSchema` |
| `logout` | `/_emdash/api/plugins/mindplex-auth/logout` | *(none — reads raw body)* |

---

## 6. Development Workflow

```bash
# Install
pnpm install

# Run Postgres locally
docker compose up -d postgres

# Apply plugin schema (once)
psql $DATABASE_URL < scripts/migrate.sql

# Dev with hot reload
pnpm dev

# Open admin
open http://localhost:4321/_emdash/admin
```

### `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB:       mindplex
      POSTGRES_USER:     mindplex
      POSTGRES_PASSWORD: mindplex
    ports:
      - "5432:5432"
```

Use the bundled scripts to start and stop Postgres:

```bash
pnpm db:up
pnpm db:down
```

### `.env`

```
DATABASE_URL=postgres://mindplex:mindplex@localhost:5432/mindplex
DB_USE_SSL=false
```

---

## 7. File Count Summary

| File | Role |
|---|---|
| `src/plugins/auth/index.ts` | Descriptor — id, version, format, capabilities, storage |
| `src/plugins/auth/sandbox-entry.ts` | `definePlugin({ hooks, routes })` — entry point |
| `src/plugins/auth/routes.ts` | All 6 handler functions |
| `src/plugins/auth/schemas.ts` | All 5 Zod schemas + TypeScript types |
| `src/plugins/auth/lib/jwt.ts` | `issueTokenPair` · `verifyAccessToken` |
| `src/plugins/auth/lib/password.ts` | `hashPassword` · `migrateIfLegacyHash` |
| `src/plugins/auth/lib/token.ts` | `generateActivationToken` |
| `src/shared/errors.ts` | Error helpers + `isUniqueViolation` |
| `src/shared/types.ts` | `Role` · `SessionUser` |
| `astro.config.mjs` | Postgres adapter + plugin registration |
| `scripts/migrate.sql` | Plugin-owned Postgres tables |

---

## 8. Capability Surface

| Plugin | Capabilities |
|---|---|
| `mindplex-auth` | `read:users`, `email:send`, `network:fetch` |

`storage` and `kv` are **always available** — no capability needed.
`ctx.db` (Kysely → Postgres) is available because this is a **native plugin** running in-process.

---

## 9. What Changed — Corrected Against the Real EmDash API

| Previous (incorrect assumptions) | Corrected (from real docs) |
|---|---|
| `ctx.router.post(...)` for route wiring | `routes: { login: { input, handler } }` named map |
| `collections:` in `definePlugin()` | `storage:` in the **descriptor** `index.ts` only |
| `ctx.db.findOne / create / update` | `ctx.db` is **Kysely** — `.selectFrom().where().executeTakeFirst()` |
| Single `index.ts` with everything | Two entrypoints: descriptor (`index.ts`) + runtime (`sandbox-entry.ts`) |
| `import from "emdash/plugin"` | `import { definePlugin } from "emdash"` |
| Valibot for validation | **Zod** — `import { z } from "astro/zod"` (EmDash routes use Zod) |
| `emdash.config.ts` registry | `astro.config.mjs` → `emdash({ plugins: [authPlugin()] })` |
| `drizzle-orm`, `pg` packages | No Drizzle — EmDash uses **Kysely** internally, exposed via `ctx.db` |
| JWT secret from `ctx.kv` with old API | `ctx.kv.get<string>("settings:jwtSecret")` — correct KV API |
| Handlers inline in `index.ts` | Handlers in `routes.ts`, wired in `sandbox-entry.ts` |
