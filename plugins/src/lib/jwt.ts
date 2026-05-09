import { SignJWT, jwtVerify } from "jose";
import { toBase64 } from "./base64";

const ISSUER = "mindplex";
const AUDIENCE = "mindplex-api";
const ACCESS_TTL = "15m";
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function issueTokenPair(
  payload: { sub: string; email: string; role: string },
  jwtSecret: string,
) {
  const secret = new TextEncoder().encode(jwtSecret);
  const sessionId = crypto.randomUUID();
  const familyId = crypto.randomUUID();

  const accessToken = await new SignJWT({ ...payload, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);

  const rawRefresh = toBase64(crypto.getRandomValues(new Uint8Array(48)));
  const hashBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawRefresh),
  );
  const tokenHash = toBase64(new Uint8Array(hashBuf));
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  return { accessToken, refreshToken: rawRefresh, tokenHash, familyId, sessionId, expiresAt };
}

export async function verifyAccessToken(token: string, jwtSecret: string) {
  const secret = new TextEncoder().encode(jwtSecret);
  return jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
}
