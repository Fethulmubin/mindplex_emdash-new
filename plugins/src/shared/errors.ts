export const conflict = (msg = "Conflict") => ({ error: msg, status: 409 });
export const badRequest = (msg = "Bad request") => ({ error: msg, status: 400 });
export const notFound = (msg = "Not found") => ({ error: msg, status: 404 });

// Postgres error code 23505 - unique_violation
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error &&
    ((err as { code?: string }).code === "23505" ||
      err.message.toLowerCase().includes("unique"))
  );
}
