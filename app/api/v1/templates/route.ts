import { NextRequest } from "next/server";
import { getBearerApiKey, unauthorizedResponse } from "@/lib/api/auth";
import { mapIntegrationActionError } from "@/lib/api/integration-route";
import { getConvexClient } from "@/lib/api/convex-server";
import { success } from "@/lib/api/response";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest) {
  const apiKey = getBearerApiKey(request);
  if (!apiKey) return unauthorizedResponse();

  try {
    const client = getConvexClient();
    const templates = await client.action(api.integration.actions.apiListTemplates, { apiKey });
    return success(templates);
  } catch (e) {
    return mapIntegrationActionError(e);
  }
}
