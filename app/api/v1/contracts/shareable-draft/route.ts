import { NextRequest } from "next/server";
import { getBearerApiKey, unauthorizedResponse } from "@/lib/api/auth";
import { mapIntegrationActionError } from "@/lib/api/integration-route";
import { getConvexClient } from "@/lib/api/convex-server";
import { success, error } from "@/lib/api/response";
import { validateShareableDraftInput } from "@/lib/api/shareable-draft";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ShareableDraftBody {
  templateId: string;
  parentContractId?: string;
  metadata?: Record<string, unknown>;
  webhookUrl?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = getBearerApiKey(request);
  if (!apiKey) return unauthorizedResponse();

  let body: ShareableDraftBody;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  if (!body.templateId) return error("templateId is required");

  const validated = validateShareableDraftInput({
    metadata: body.metadata,
    webhookUrl: body.webhookUrl,
  });
  if (!validated.ok) return error(validated.message);

  try {
    const client = getConvexClient();
    const result = await client.action(api.integration.actions.apiShareableDraft, {
      apiKey,
      templateId: body.templateId as Id<"contractTemplates">,
      parentContractId: body.parentContractId
        ? (body.parentContractId as Id<"contracts">)
        : undefined,
      integrationMetadata:
        Object.keys(validated.metadata).length > 0 ? validated.metadata : undefined,
      integrationWebhookUrl: validated.webhookUrl,
    });
    return success(
      {
        contractId: result.contractId,
        fillLink: result.fillLink,
      },
      201
    );
  } catch (e) {
    return mapIntegrationActionError(e);
  }
}
