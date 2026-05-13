import type { PluginContext } from "emdash";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db/client";
import { hashPassword, migrateIfLegacyHash } from "../../lib/password";
import { issueTokenPair } from "../../lib/jwt";
import { generateActivationToken } from "../../lib/token";
import { toBase64 } from "../../lib/base64";
import { isUniqueViolation } from "../../shared/errors";
import {
  activationTokens,
  refreshTokens,
  userNotificationSettings,
  userPreferences,
  userProfiles,
  users,
} from "../../db/schema";
import type {
  ActivateInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  SocialInput,
} from "./schemas";

async function hashRefreshToken(rawToken: string) {
  const hashBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  return toBase64(new Uint8Array(hashBuf));
}

async function getJwtSecret(ctx: PluginContext) {
  return (await ctx.kv.get<string>("settings:jwtSecret")) ?? "";
}

async function getUserByEmail(_ctx: PluginContext, email: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows: any[]) => rows[0]);
}

async function getUserById(_ctx: PluginContext, id: number) {
  return db
    .select()
    .from(users)
    .where(eq(users.id, id))
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

export async function register(input: RegisterInput, ctx: PluginContext) {
  if (!input?.email || !input?.password || !input?.username) {
    return { error: "Invalid input", status: 400 };
  }

  const { email, password, username } = input;
  const passwordHash = await hashPassword(password);

  if (!ctx.email) {
    return { error: "Email service is not configured", status: 500 };
  }

  try {
    const user = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
        role: "user",
        isActivated: false,
      })
      .returning({ id: users.id })
      .then((rows: any[]) => rows[0]);

    await db.insert(userProfiles).values({ userId: user.id });
    await db.insert(userPreferences).values({ userId: user.id });
    await db.insert(userNotificationSettings).values({ userId: user.id });

    const token = generateActivationToken();
    const expiresAt = new Date(Date.now() + 86_400_000);

    await db.insert(activationTokens).values({ token, userId: user.id, expiresAt });

    const activationLink = `/activate?token=${token}`;
    await ctx.email.send({
      to: email,
      subject: "Activate your Mindplex account",
      html: `<a href="${activationLink}">Activate account</a>`,
      text: `Activate your account: ${activationLink}`,
    });

    return { data: { id: user.id }, status: 201 };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "Email or username already taken", status: 409 };
    }
    throw err;
  }
}

export async function activate(input: ActivateInput, ctx: PluginContext) {
  const { token } = input;

  const record = await db
    .select()
    .from(activationTokens)
    .where(and(eq(activationTokens.token, token), gt(activationTokens.expiresAt, new Date())))
    .limit(1)
    .then((rows: any[]) => rows[0]);

  if (!record) return { error: "Invalid or expired token", status: 400 };

  await db.update(users).set({ isActivated: true }).where(eq(users.id, record.userId));

  await db.delete(activationTokens).where(eq(activationTokens.id, record.id));

  return { data: { ok: true } };
}

export async function social(input: SocialInput, ctx: PluginContext) {
  const { idToken } = input;

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
    user = await db
      .insert(users)
      .values({
        email: gData.email,
        username,
        role: "user",
        isActivated: true,
      })
      .returning()
      .then((rows: any[]) => rows[0]);

    await db.insert(userProfiles).values({ userId: user.id });
    await db.insert(userPreferences).values({ userId: user.id });
    await db.insert(userNotificationSettings).values({ userId: user.id });
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

export async function refresh(input: RefreshInput, ctx: PluginContext) {
  const { refreshToken } = input;
  const hash = await hashRefreshToken(refreshToken);

  const token = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.token, hash), gt(refreshTokens.expiresAt, new Date())))
    .limit(1)
    .then((rows: any[]) => rows[0]);

  if (!token) return { error: "Invalid or expired token", status: 401 };

  await db.delete(refreshTokens).where(eq(refreshTokens.id, token.id));

  const user = await getUserById(ctx, token.userId);

  if (!user) return { error: "User not found", status: 401 };

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
  // In standard plugins, logout has no input schema
  // The refreshToken would typically be passed via input if needed
  return { data: { ok: true } };
}
