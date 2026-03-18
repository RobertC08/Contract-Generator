import { NextRequest } from "next/server";
import { getBearerApiKey, unauthorizedResponse } from "@/lib/api/auth";
import { mapIntegrationActionError } from "@/lib/api/integration-route";
import { getConvexClient } from "@/lib/api/convex-server";
import { success, error } from "@/lib/api/response";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type SignerRole = "teacher" | "student" | "guardian" | "school_music";
const VALID_ROLES: SignerRole[] = ["teacher", "student", "guardian", "school_music"];

interface CreateContractBody {
  templateId: string;
  parentContractId?: string;
  variables: Record<string, string>;
  signers: Array<{
    fullName: string;
    email: string;
    phone?: string;
    role?: string;
    signingOrder?: number;
  }>;
}

export async function POST(request: NextRequest) {
  const apiKey = getBearerApiKey(request);
  if (!apiKey) return unauthorizedResponse();

  let body: CreateContractBody;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  if (!body.templateId) return error("templateId is required");
  if (!body.signers || !Array.isArray(body.signers) || body.signers.length === 0) {
    return error("At least one signer is required");
  }

  for (const signer of body.signers) {
    if (!signer.fullName || !signer.email) {
      return error("Each signer must have fullName and email");
    }
    if (signer.role && !VALID_ROLES.includes(signer.role as SignerRole)) {
      return error(`Invalid signer role: ${signer.role}. Valid: ${VALID_ROLES.join(", ")}`);
    }
  }

  const variablesList = Object.entries(body.variables ?? {}).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
  }));

  try {
    const client = getConvexClient();
    const result = await client.action(api.integration.actions.apiCreateContract, {
      apiKey,
      templateId: body.templateId as Id<"contractTemplates">,
      parentContractId: body.parentContractId
        ? (body.parentContractId as Id<"contracts">)
        : undefined,
      variablesList,
      signers: body.signers.map((s) => ({
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        role: s.role as SignerRole | undefined,
        signingOrder: s.signingOrder,
      })),
    });
    return success(result, 201);
  } catch (e) {
    return mapIntegrationActionError(e);
  }
}
