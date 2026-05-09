import type { PluginContext } from "emdash";
import { pgPool } from "../../db/client";
import { hashPassword, migrateIfLegacyHash } from "../../lib/password";
import { issueTokenPair } from "../../lib/jwt";
import { generateActivationToken } from "../../lib/token";
import { toBase64 } from "../../lib/base64";
import { isUniqueViolation } from "../../shared/errors";
// core schema/tables are accessed via raw SQL (pgPool)
import type {
  ActivateInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  SocialInput,
} from "./schemas";

type NativePluginContext = PluginContext & {
  db: any;
  input?: unknown;
  request: Request;
};

async function hashRefreshToken(rawToken: string) {
  const hashBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  return toBase64(new Uint8Array(hashBuf));
}

async function getJwtSecret(ctx: NativePluginContext) {
  return (await ctx.kv.get<string>("settings:jwtSecret")) ?? "";
}

async function getUserByEmail(ctx: NativePluginContext, email: string) {
  const res = await pgPool.query(`SELECT id, email, name, role FROM users WHERE email = $1 LIMIT 1`, [
    email.toLowerCase(),
  ]);
  return res.rows[0] ?? null;
}

async function getUserById(ctx: NativePluginContext, id: string) {
  const res = await pgPool.query(`SELECT id, email, name, role FROM users WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] ?? null;
}

export async function login(ctx: NativePluginContext) {
  const { email, password } = ctx.input as LoginInput;

  const user = await getUserByEmail(ctx, email);

  if (!user) return { error: "Invalid credentials", status: 401 };

  // Get plugin-local password hash
  const pa = await pgPool.query(`SELECT password_hash FROM plugin_local_auth WHERE user_id = $1`, [user.id]);
  const storedHash = pa.rows[0]?.password_hash ?? null;

  const { valid, migrated, newHash } = await migrateIfLegacyHash(password, storedHash);
  if (!valid) return { error: "Invalid credentials", status: 401 };

  if (migrated && newHash) {
    await pgPool.query(`UPDATE plugin_local_auth SET password_hash = $1 WHERE user_id = $2`, [newHash, user.id]);
  }

  const jwtSecret = await getJwtSecret(ctx);
  const tokens = await issueTokenPair({ sub: user.id, email: user.email, role: user.role }, jwtSecret);

  // Ensure refresh table exists and insert token
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS plugin_refresh_tokens (
      id text PRIMARY KEY,
      user_id text,
      token text,
      family_id text,
      metadata jsonb,
      expires_at text,
      family_expires_at text,
      created_at text DEFAULT now()
    )
  `);

  await pgPool.query(
    `INSERT INTO plugin_refresh_tokens(id,user_id,token,family_id,metadata,expires_at,family_expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())`,
    [crypto.randomUUID(), user.id, tokens.tokenHash, tokens.familyId, JSON.stringify({ sessionId: tokens.sessionId }), tokens.expiresAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()],
  );

  return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
}

export async function register(ctx: NativePluginContext) {
  const input = ctx.input as RegisterInput | undefined;
  if (!input?.email || !input?.password || !input?.username) {
    return { error: "Invalid input", status: 400 };
  }

  const { email, password, username } = input;
  const passwordHash = await hashPassword(password);

  if (!ctx.email) {
    return { error: "Email service is not configured", status: 500 };
  }

  try {
    // Ensure local auth and refresh tables exist
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS plugin_local_auth (
        user_id text PRIMARY KEY,
        password_hash text NOT NULL
      )
    `);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS plugin_refresh_tokens (
        id text PRIMARY KEY,
        user_id text,
        token text,
        family_id text,
        metadata jsonb,
        expires_at text,
        family_expires_at text,
        created_at text DEFAULT now()
      )
    `);

    // Create user in EmDash core users table
    const userId = crypto.randomUUID();
    await pgPool.query(
      `INSERT INTO users(id, email, name, role, avatar_url, email_verified, data, created_at, updated_at, disabled) VALUES($1,$2,$3,$4,$5,0,NULL,now(),now(),0)`,
      [userId, email.toLowerCase(), username, 10, null],
    );

    // Store password in plugin-local auth table
    await pgPool.query(`INSERT INTO plugin_local_auth(user_id, password_hash) VALUES($1,$2)`, [userId, passwordHash]);

    // Create activation token in core auth_tokens table
    const token = generateActivationToken();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    await pgPool.query(`INSERT INTO auth_tokens(hash, user_id, type, expires_at, created_at) VALUES($1,$2,$3,$4,now())`, [
      token,
      userId,
      "email_verify",
      expiresAt,
    ]);

    const activationLink = `/activate?token=${token}`;
    await ctx.email.send({
      to: email,
      subject: "Activate your Mindplex account",
      html: `<a href="${activationLink}">Activate account</a>`,
      text: `Activate your account: ${activationLink}`,
    });

    return { data: { id: userId }, status: 201 };
  } catch (err: any) {
    if (isUniqueViolation(err)) {
      return { error: "Email or username already taken", status: 409 };
    }
    throw err;
  }
}

export async function activate(ctx: NativePluginContext) {
  const { token } = ctx.input as ActivateInput;

  const res = await pgPool.query(`SELECT hash, user_id, expires_at FROM auth_tokens WHERE hash = $1 AND type = $2 LIMIT 1`, [token, "email_verify"]);
  const record = res.rows[0];
  if (!record || new Date(record.expires_at) <= new Date()) return { error: "Invalid or expired token", status: 400 };

  await pgPool.query(`UPDATE users SET email_verified = 1 WHERE id = $1`, [record.user_id]);
  await pgPool.query(`DELETE FROM auth_tokens WHERE hash = $1`, [token]);

  return { data: { ok: true } };
}

export async function social(ctx: NativePluginContext) {
  const { idToken } = ctx.input as SocialInput;

  if (!ctx.http) return { error: "Network access is not configured", status: 500 };

  const gRes = await ctx.http.fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
  );
  const gData = (await gRes.json()) as { email?: string; error?: string };

  if (!gRes.ok || !gData.email) return { error: "Invalid Google token", status: 401 };

  let user = await getUserByEmail(ctx, gData.email);

  if (!user) {
    const username = `${gData.email.split("@")[0]}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const userId = ulid();
    await pgPool.query(`INSERT INTO users(id,email,name,role,created_at,updated_at) VALUES($1,$2,$3,$4,now(),now())`, [
      userId,
      gData.email.toLowerCase(),
      username,
      10,
    ]);
    user = { id: userId, email: gData.email.toLowerCase(), name: username, role: 10 };
  }

  const jwtSecret = await getJwtSecret(ctx);
  const tokens = await issueTokenPair(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
  );

  await pgPool.query(
    `INSERT INTO plugin_refresh_tokens(id,user_id,token,family_id,metadata,expires_at,family_expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())`,
    [crypto.randomUUID(), user.id, tokens.tokenHash, tokens.familyId, JSON.stringify({ sessionId: tokens.sessionId }), tokens.expiresAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()],
  );

  return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
}

export async function refresh(ctx: NativePluginContext) {
  const { refreshToken } = ctx.input as RefreshInput;
  const hash = await hashRefreshToken(refreshToken);

  const res = await pgPool.query(`SELECT id, user_id FROM plugin_refresh_tokens WHERE token = $1 AND expires_at > now() LIMIT 1`, [hash]);
  const token = res.rows[0];

  if (!token) return { error: "Invalid or expired token", status: 401 };

  await pgPool.query(`DELETE FROM plugin_refresh_tokens WHERE id = $1`, [token.id]);

  const user = await getUserById(ctx, token.user_id);

  if (!user) return { error: "User not found", status: 401 };

  const jwtSecret = await getJwtSecret(ctx);
  const tokens = await issueTokenPair(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
  );

  await pgPool.query(
    `INSERT INTO plugin_refresh_tokens(id,user_id,token,family_id,metadata,expires_at,family_expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())`,
    [ulid(), user.id, tokens.tokenHash, tokens.familyId, JSON.stringify({ sessionId: tokens.sessionId }), tokens.expiresAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()],
  );

  return { data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
}

export async function logout(ctx: NativePluginContext) {
  const body = (await ctx.request.json().catch(() => ({}))) as {
    refreshToken?: string;
  };

  if (body?.refreshToken) {
    const hash = await hashRefreshToken(body.refreshToken);

    const res = await pgPool.query(`SELECT family_id FROM plugin_refresh_tokens WHERE token = $1 LIMIT 1`, [hash]);
    const token = res.rows[0];
    if (token) {
      await pgPool.query(`DELETE FROM plugin_refresh_tokens WHERE family_id = $1`, [token.family_id]);
    }
  }

  return { data: { ok: true } };
}
