import { NextRequest } from "next/server";
import { getBearerApiKey, unauthorizedResponse } from "@/lib/api/auth";
import { mapIntegrationActionError } from "@/lib/api/integration-route";
import { getConvexClient } from "@/lib/api/convex-server";
import { success } from "@/lib/api/response";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = getBearerApiKey(request);
  if (!apiKey) return unauthorizedResponse();

  const { id } = await params;

  try {
    const client = getConvexClient();
    const template = await client.action(api.integration.actions.apiGetTemplate, {
      apiKey,
      templateId: id as Id<"contractTemplates">,
    });
    return success(template);
  } catch (e) {
    return mapIntegrationActionError(e);
  }
}
