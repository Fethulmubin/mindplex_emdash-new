# Mindplex EmDash CMS - Architecture Guide

## Overview

Mindplex is an **EmDash CMS** built on Astro with a **modular plugin architecture**. The system uses a two-layer plugin pattern: plugin descriptors declare capabilities, security rules, and entrypoints, while sandbox entries contain the actual implementation.

**Technology Stack:**
- **Framework**: Astro (server-rendered)
- **CMS**: EmDash (headless CMS with admin UI)
- **Database**: PostgreSQL with Drizzle ORM
- **Package Management**: pnpm (monorepo)
- **Plugin Format**: EmDash standard plugins

---

## Plugin Architecture Pattern

The plugin architecture follows a **declarative → implementation** pattern with three key layers:

### Layer 1: Plugin Descriptor (index.ts)

Declares plugin metadata, capabilities, and security constraints.

```typescript
// plugins/src/routes/auth/index.ts
import type { PluginDescriptor } from "emdash";

export function authPlugin(): PluginDescriptor {
  return {
    id: "mindplex-auth",                              // Unique plugin ID
    version: "1.0.0",
    format: "standard",                               // EmDash standard format
    entrypoint: "@mindplex/plugins/auth/sandbox",    // NPM export reference
    options: {},
    capabilities: ["email:send", "network:request"], // Required capabilities
    allowedHosts: [
      "oauth2.googleapis.com",
      "www.googleapis.com"
    ],                                                // Network whitelist
    storage: {},
  };
}
```

**Key Fields:**
- `entrypoint`: Reference to the sandbox implementation via npm exports (not file paths)
- `capabilities`: Declare what the plugin needs (email, network, content, etc.)
- `allowedHosts`: Restrict external network access to specific domains
- `format`: "standard" for EmDash plugins (alternatively "native" for framework-level plugins)

### Layer 2: Sandbox Entry Point (sandbox-entry.ts)

Contains the actual plugin implementation using `definePlugin()`.

```typescript
// plugins/src/routes/auth/sandbox-entry.ts
import { Buffer } from "node:buffer";
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import {
  ActivateSchema,
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  SocialSchema,
} from "./schemas";
import { activate, login, logout, refresh, register, social } from "./routes";

export default definePlugin({
  hooks: {
    "plugin:install": {
      handler: async (_event: any, ctx: PluginContext) => {
        const existing = await ctx.kv.get("settings:jwtSecret");
        if (!existing) {
          const secret = crypto.getRandomValues(new Uint8Array(48));
          const jwtSecret = Buffer.from(secret).toString("base64");
          await ctx.kv.set("settings:jwtSecret", jwtSecret);
          ctx.log.info("mindplex-auth: generated JWT secret");
        }
      },
    },
  },
  routes: {
    login: {
      public: true,
      input: LoginSchema,
      handler: login,
    },
    register: {
      public: true,
      input: RegisterSchema,
      handler: register,
    },
    activate: {
      public: true,
      input: ActivateSchema,
      handler: activate,
    },
    social: {
      public: true,
      input: SocialSchema,
      handler: social,
    },
    refresh: {
      public: true,
      input: RefreshSchema,
      handler: refresh,
    },
    logout: {
      public: true,
      handler: logout,
    },
    admin: {
      handler: async (_ctx: any) => {
        return { blocks: [{ type: "text", text: "Auth admin" }] };
      },
    },
  },
});
```

**Plugin Hook Lifecycle:**
- `plugin:install`: Runs once when plugin is installed (JWT secret generation)
- `plugin:uninstall`: Runs when plugin is removed
- `plugin:enable`/`plugin:disable`: Runs on state changes

**Plugin Context (`ctx`) provides access to:**
- `ctx.kv`: Key-value storage for plugin settings
- `ctx.email`: Email service (if `email:send` capability granted)
- `ctx.http`: Network access (if `network:request` capability granted)
- `ctx.content`: CMS content management (if `content:read`/`content:write` granted)
- `ctx.log`: Logging service

### Layer 3: Route Implementations (routes.ts)

Handler functions that process requests.

```typescript
// plugins/src/routes/auth/routes.ts
import type { PluginContext } from "emdash";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { hashPassword, migrateIfLegacyHash } from "../../lib/password";
import { issueTokenPair } from "../../lib/jwt";
import { users, refreshTokens } from "../../db/schema";
import type { LoginInput } from "./schemas";

async function getUserByEmail(_ctx: PluginContext, email: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows: any[]) => rows[0]);
}

export async function login(input: LoginInput, ctx: PluginContext) {
  const { email, password } = input;

  const user = await getUserByEmail(ctx, email);
  if (!user) return { error: "Invalid credentials", status: 401 };

  const { valid, migrated, newHash } = await migrateIfLegacyHash(
    password,
    user.passwordHash,
  );
  if (!valid) return { error: "Invalid credentials", status: 401 };

  if (migrated && newHash) {
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
  }

  const jwtSecret = await getJwtSecret(ctx);
  const tokens = await issueTokenPair(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
  );

  await db.insert(refreshTokens).values({
    token: tokens.tokenHash,
    userId: user.id,
    familyId: tokens.familyId,
    metadata: {},
    expiresAt: tokens.expiresAt,
    familyExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
}

export async function logout(_input: unknown, ctx: PluginContext) {
  return { data: { ok: true } };
}
```

---

## Database Schema Pattern

Schemas use **Drizzle ORM** with **table prefixes** to namespace plugin data.

```typescript
// plugins/src/db/schema/users.ts
import { pgTable, serial, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("plugin_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 60 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  isActivated: boolean("is_activated").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const refreshTokens = pgTable("plugin_refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).unique().notNull(),
  familyId: varchar("family_id", { length: 255 }).notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  metadata: jsonb("metadata").default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  familyExpiresAt: timestamp("family_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activationTokens = pgTable("plugin_activation_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Schema Namespace Pattern:**
- All plugin tables use `plugin_` prefix: `plugin_users`, `plugin_refresh_tokens`, etc.
- Prevents table name collisions when multiple plugins coexist
- Central export file aggregates all schemas

```typescript
// plugins/src/db/schema/index.ts
export * from "./users";
export * from "./posts";
export * from "./taxonomies";
export * from "./comments";
// ... other schemas
```

---

## Content Management Routes

The **Posts Plugin** demonstrates content querying patterns:

```typescript
// plugins/src/routes/posts/sandbox-entry.ts
export default definePlugin({
  routes: {
    posts: {
      public: true,
      handler: getPostsHandler,
    },
    "posts/:identifier": {
      public: true,
      handler: getPostHandler,
    },
    "posts/create-post": {
      public: true,
      input: CreatePostSchema,
      handler: createPostHandler,
    },
    "posts/:identifier/comments": {
      public: true,
      handler: listPostCommentsHandler,
    },
  },
});
```

**Route Implementation with Content API:**

```typescript
// plugins/src/routes/posts/routes.ts
async function getPosts(ctx: PluginContext, params: ListPostsParams) {
  const options: any = {
    limit: Math.min(params.limit ?? 10, 100),
    cursor: params.cursor,
    where: {
      status: "published",
    },
  };

  if (params.type) {
    options.where.type = params.type;
  }

  if (params.feed === "editors-pick") {
    options.where.is_editors_pick = true;
  }

  // Uses ctx.content to query CMS collections
  return ctx.content!.list("posts", options);
}

async function createPost(ctx: PluginContext, input: CreatePostInput) {
  const slug = input.slug?.trim() || generateSlug(input.title);

  const payload: any = {
    title: input.title,
    content: typeof input.content === "string"
      ? [{ _type: "block", children: [{ _type: "span", text: input.content }] }]
      : input.content,
    type: input.type,
    slug,
    status: input.status || "draft",
    published_at: new Date().toISOString(),
    excerpt: input.excerpt,
    author: input.author,
    comment_enabled: input.comment_enabled ?? true,
  };

  return ctx.content.create!("posts", payload);
}

export async function getPostsHandler(routeCtx: any, ctx: PluginContext) {
  const url = new URL(routeCtx.request.url);
  const type = url.searchParams.get("type");
  const feed = url.searchParams.get("feed");
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  const result = await getPosts(ctx, {
    type: type || undefined,
    feed: feed || undefined,
    limit,
  });
  return { success: true, data: result };
}
```

---

## Plugin Registration & Integration

Plugins are registered in the main Astro config:

```typescript
// astro.config.mjs
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { postgres } from "emdash/db";
import { authPlugin, postsPlugin } from "./plugins/src/index.ts";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    emdash({
      database: postgres({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_USE_SSL === "true",
      }),
      plugins: [authPlugin(), postsPlugin()],  // Instantiate plugins
    }),
  ],
});
```

---

## Package Structure

### monorepo layout

```
mindplex_emdashcms/
├── astro.config.mjs              # Main Astro config with EmDash integration
├── package.json                  # Root workspace
├── plugins/                      # Plugins package (local file dependency)
│   ├── package.json             # @mindplex/plugins scoped package
│   ├── src/
│   │   ├── index.ts             # Main exports (authPlugin, postsPlugin)
│   │   ├── routes/
│   │   │   ├── auth/
│   │   │   │   ├── index.ts      # Plugin descriptor (capabilities, entrypoint)
│   │   │   │   ├── sandbox-entry.ts  # Plugin implementation (definePlugin)
│   │   │   │   ├── routes.ts     # Route handlers (login, register, etc)
│   │   │   │   └── schemas.ts    # Input validation schemas
│   │   │   ├── posts/
│   │   │   │   ├── index.ts
│   │   │   │   ├── sandbox-entry.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── schemas.ts
│   │   │   └── users/            # Incomplete plugin (empty implementation)
│   │   └── db/
│   │       ├── client.ts         # Drizzle client
│   │       └── schema/
│   │           ├── index.ts      # Re-exports all schemas
│   │           ├── users.ts
│   │           ├── posts.ts
│   │           └── ...
│   └── src/lib/                  # Shared utilities
│       ├── password.ts
│       ├── jwt.ts
│       └── token.ts
└── src/
    ├── pages/                    # Astro pages
    └── layouts/
        └── Base.astro
```

### npm Package Export Map

```json
// plugins/package.json
{
  "name": "@mindplex/plugins",
  "exports": {
    ".": "./src/index.ts",
    "./auth": "./src/routes/auth/index.ts",
    "./auth/sandbox": "./src/routes/auth/sandbox-entry.ts",
    "./posts": "./src/routes/posts/index.ts",
    "./posts/sandbox": "./src/routes/posts/sandbox-entry.ts"
  }
}
```

**Export Pattern:**
- `.` → Main entry (descriptor functions)
- `./auth` → Auth plugin descriptor
- `./auth/sandbox` → Auth plugin implementation
- `./posts` → Posts plugin descriptor
- `./posts/sandbox` → Posts plugin implementation

The `entrypoint` field in descriptors references these exports:
```typescript
entrypoint: "@mindplex/plugins/auth/sandbox"  // References ./auth/sandbox export
```

---

## Plugin Communication Flow

```
1. astro.config.mjs
   └─> calls authPlugin() and postsPlugin()
   
2. Plugin Descriptors (index.ts)
   └─> Returns PluginDescriptor objects
   └─> Specifies capabilities, entrypoints, security rules
   
3. EmDash Framework
   └─> Loads plugins using descriptors
   └─> Validates capabilities & entrypoints
   
4. Sandbox Entry Points (sandbox-entry.ts)
   └─> Instantiated by EmDash framework
   └─> definePlugin() creates isolated execution context
   └─> Routes available at /api/plugin/{pluginId}/{routeName}
   
5. Route Handlers (routes.ts)
   └─> Execute with PluginContext
   └─> Access ctx.kv, ctx.email, ctx.http, ctx.content
   └─> Query database directly or via content API
```

---

## Security & Capabilities System

Plugins declare required capabilities; EmDash grants or denies access:

```typescript
// Auth Plugin requires external email and network
capabilities: ["email:send", "network:request"],
allowedHosts: ["oauth2.googleapis.com", "www.googleapis.com"],

// Posts Plugin only needs content access
capabilities: ["content:read", "content:write"],
```

**Capability Types:**
- `email:send` → Access to ctx.email service
- `network:request` → Access to ctx.http.fetch() with host whitelist
- `content:read` → Read collections via ctx.content.list()
- `content:write` → Create/update content via ctx.content.create()
- `storage:read`/`storage:write` → Plugin-isolated storage
- `users:read`/`users:write` → User management

**Network Security:**
- `allowedHosts` array restricts fetch() to specific domains
- OAuth2 Google domain whitelisted for social login

---

## Key Architectural Strengths

✅ **Modular Separation**: Each plugin is self-contained with its own routes, schemas, and database tables

✅ **Monorepo Pattern**: Single local file dependency (`"@mindplex/plugins": "file:./plugins"`) simplifies development

✅ **Capability-Based Security**: Plugins declare what they need; framework grants or denies

✅ **Database Isolation**: Table prefixes (`plugin_*`) prevent collisions

✅ **Hot-reload Ready**: Plugins are loadable at runtime via plugin registry

✅ **Type Safety**: Drizzle ORM + TypeScript for database queries

---

## Known Issues & Inconsistencies

⚠️ **Format Inconsistency**: 
- Auth and Posts plugins use `format: "standard"` (correct)
- Users plugin uses `format: "native"` (inconsistent, likely incorrect)

⚠️ **Users Plugin Incomplete**:
- Empty `definePlugin()` with no hooks or routes
- Defined in schema but not fully implemented

⚠️ **Missing Export**:
- Users plugin descriptor exists but not exported from `plugins/src/index.ts`

⚠️ **Entrypoint Path Inconsistency**:
- Auth/Posts correctly use NPM exports: `"@mindplex/plugins/auth/sandbox"`
- Users plugin uses relative path (if implemented): `"./plugins/src/routes/users/sandbox-entry.ts"`

⚠️ **Database Schema Coupling**:
- Plugins directly reference database schema tables
- No content API abstraction for data access (unlike Posts plugin)
- Could limit plugin portability

---

## Recommendations

### Short Term (Fixes)

1. **Fix Users Plugin Format**
   ```typescript
   // plugins/src/routes/users/index.ts
   export function usersPlugin(): PluginDescriptor {
     return {
       id: "mindplex-users",
       version: "1.0.0",
       format: "standard",  // NOT "native"
       entrypoint: "@mindplex/plugins/users/sandbox",
       // ...
     };
   }
   ```

2. **Complete Users Plugin Implementation**
   ```typescript
   // plugins/src/routes/users/sandbox-entry.ts
   export default definePlugin({
     routes: {
       profile: { handler: getUserProfile },
       "profile/:id": { handler: getOtherUserProfile },
       "profile/update": { handler: updateUserProfile },
     },
   });
   ```

3. **Export Users Plugin**
   ```typescript
   // plugins/src/index.ts
   export { authPlugin } from "./routes/auth";
   export { postsPlugin } from "./routes/posts";
   export { usersPlugin } from "./routes/users";  // Add this
   ```

4. **Add to astro.config.mjs**
   ```typescript
   import { authPlugin, postsPlugin, usersPlugin } from "./plugins/src/index.ts";
   
   plugins: [authPlugin(), postsPlugin(), usersPlugin()],
   ```

### Medium Term (Architecture Improvements)

1. **Standardize Database Access Pattern**
   - Posts plugin uses `ctx.content.list()` and `ctx.content.create()`
   - Auth plugin uses direct `db.select()` queries
   - Recommend content API for all plugins for consistency

2. **Document Plugin Capabilities**
   - Create PLUGIN_CAPABILITIES.md describing each capability type
   - Provide examples for common patterns

3. **Add Plugin Testing Pattern**
   - Create test fixtures for plugin context mocking
   - Document integration test approach

### Long Term (Scalability)

1. **Plugin Discovery System**
   - Implement auto-loading from `plugins/` directory
   - Current: Manual import in `astro.config.mjs`
   - Future: Scan directory, auto-register plugins

2. **Plugin Configuration Store**
   - Move hardcoded config (allowedHosts, capabilities) to config files
   - Enable admin UI to enable/disable plugins

3. **Cross-Plugin Communication**
   - Implement event system for plugins to emit/listen to events
   - E.g., "user:created", "post:published"

4. **Plugin Versioning & Compatibility**
   - Semantic versioning for plugins
   - Compatibility matrix to prevent breaking updates

---

## Development Workflow

### Starting the Dev Server
```bash
npx emdash dev
```
- Runs migrations
- Regenerates TypeScript types
- Loads all registered plugins

### Adding a New Plugin Route

1. **Define input schema** (`routes/[plugin]/schemas.ts`)
2. **Implement handler** (`routes/[plugin]/routes.ts`)
3. **Register in sandbox entry** (`routes/[plugin]/sandbox-entry.ts`)
4. **Export descriptor** (`routes/[plugin]/index.ts`)
5. **Add to monorepo exports** (`plugins/package.json`)
6. **Register in config** (`astro.config.mjs`)

### Accessing Plugin Routes
```
GET /api/plugin/mindplex-auth/login
POST /api/plugin/mindplex-posts/posts/create-post
GET /api/plugin/mindplex-posts/posts/:identifier
```

---

## Conclusion

The **plugin architecture is solid and well-suited for extensibility**. The three-layer pattern (descriptors → implementations → handlers) provides clear separation of concerns. The capability-based security model ensures plugins declare their dependencies explicitly. However, the project would benefit from:

1. **Consistency**: Standardize database access patterns across plugins
2. **Completeness**: Finish the users plugin implementation
3. **Documentation**: Document capabilities and patterns for future plugins
4. **Scalability**: Implement plugin discovery and cross-plugin communication

The foundation is strong for building additional plugins following the established patterns.
