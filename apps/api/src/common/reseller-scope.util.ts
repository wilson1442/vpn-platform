import { PrismaService } from './prisma.service';

export async function getResellerSubtreeIds(
  prisma: PrismaService,
  rootResellerId: string,
): Promise<string[]> {
  const result = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM "Reseller" WHERE id = ${rootResellerId}
      UNION ALL
      SELECT r.id FROM "Reseller" r INNER JOIN subtree s ON r."parentId" = s.id
    )
    SELECT id FROM subtree
  `;
  return result.map((r) => r.id);
}
