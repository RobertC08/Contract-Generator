"use node";

import { createHash } from "crypto";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function resolveOrgId(
  ctx: ActionCtx,
  apiKey: string
): Promise<Id<"organizations"> | null> {
  const key = apiKey.trim();
  if (!key) return null;
  const hash = createHash("sha256").update(key).digest("hex");
  const row = await ctx.runQuery(internal.integrationApiKeys.getByKeyHash, { keyHash: hash });
  if (!row || row.revokedAt) return null;
  await ctx.runMutation(internal.integrationApiKeys.markKeyUsed, { keyId: row._id });
  return row.orgId;
}

export async function requireOrg(
  ctx: ActionCtx,
  apiKey: string
): Promise<Id<"organizations">> {
  const orgId = await resolveOrgId(ctx, apiKey);
  if (!orgId) throw new Error("Invalid API key");
  return orgId;
}
