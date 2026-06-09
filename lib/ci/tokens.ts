import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { ProjectApiToken } from "@prisma/client";

// CI project API tokens. The raw token is shown to the user exactly once;
// we persist only its sha256 hash (for lookup) plus a short prefix (for
// identification in the UI). Format: `qacs_<32 hex chars>`.

const TOKEN_PREFIX_LEN = 8;

/**
 * Generates a new project API token.
 * @returns the raw token (show once), its display prefix, and its sha256 hash.
 */
export function generateToken(): { raw: string; prefix: string; hash: string } {
  const raw = `qacs_${randomBytes(16).toString("hex")}`; // 32 hex chars
  const prefix = raw.slice(0, TOKEN_PREFIX_LEN);
  const hash = hashToken(raw);
  return { raw, prefix, hash };
}

/** Returns the sha256 (hex) of a raw token, used for storage + lookup. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Verifies a raw bearer token. Returns the matching token row if it exists,
 * is not revoked, and is not expired — and bumps `lastUsedAt`. Otherwise null.
 */
export async function verifyToken(
  raw: string,
): Promise<ProjectApiToken | null> {
  if (!raw || !raw.startsWith("qacs_")) return null;
  const hash = hashToken(raw);
  const token = await prisma.projectApiToken.findUnique({
    where: { tokenHash: hash },
  });
  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt.getTime() <= Date.now()) return null;

  await prisma.projectApiToken
    .update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return token;
}
