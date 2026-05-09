import { hash, verify } from "@node-rs/argon2";

export const hashPassword = (plain: string) => hash(plain);

export async function migrateIfLegacyHash(
  plain: string,
  stored: string,
): Promise<{ valid: boolean; migrated: boolean; newHash?: string }> {
  if (stored.startsWith("$argon2")) {
    return { valid: await verify(stored, plain), migrated: false };
  }
  const valid = stored === plain;
  if (!valid) return { valid: false, migrated: false };
  return { valid: true, migrated: true, newHash: await hashPassword(plain) };
}
