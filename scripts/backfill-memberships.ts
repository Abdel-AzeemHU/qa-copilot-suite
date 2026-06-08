/**
 * Idempotent backfill: ensure every Organization has an owner Membership row
 * for its `ownerId`. Safe to run repeatedly.
 *
 * Run against a given DB:
 *   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-memberships.ts
 *   DATABASE_URL="file:./dev.db" npx tsx scripts/backfill-memberships.ts
 */
import { prisma } from "@/lib/db/prisma";

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, ownerId: true, name: true },
  });

  let created = 0;
  for (const org of orgs) {
    const result = await prisma.membership.upsert({
      where: { userId_orgId: { userId: org.ownerId, orgId: org.id } },
      update: {},
      create: { userId: org.ownerId, orgId: org.id, role: "owner" },
    });
    if (result.role === "owner") created++;
  }

  console.log(
    `Backfill complete. Orgs: ${orgs.length}. Owner memberships ensured: ${created}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
