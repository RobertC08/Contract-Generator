import { PrismaClient } from "@prisma/client";

/**
 * Create a new template version instead of overwriting.
 * Use this when adding/updating templates so each row has a unique version.
 */
export async function createTemplateVersion(
  prisma: PrismaClient,
  data: { name: string; content: string }
): Promise<{ id: string; version: number }> {
  const latest = await prisma.contractTemplate.findFirst({
    where: { name: data.name },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;
  const template = await prisma.contractTemplate.create({
    data: { name: data.name, content: data.content, version },
  });
  return { id: template.id, version: template.version };
}
