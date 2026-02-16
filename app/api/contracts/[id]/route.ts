import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LocalStorageProvider } from "@/lib/storage/storage-provider";
import { updateDraftContract } from "@/lib/contracts/contract-service";
import {
  TemplateNotFoundError,
  TemplateRenderError,
  StorageError,
  ContractSignedError,
} from "@/lib/contracts/errors";

export const runtime = "nodejs";

const signerInputSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["teacher", "student", "guardian"]).optional(),
});

const updateDraftSchema = z.object({
  variables: z.record(z.string(), z.unknown()),
  signers: z.array(signerInputSchema).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      signers: { orderBy: { signingOrder: "asc" } },
      template: { select: { id: true, name: true } },
    },
  });
  if (!contract) return NextResponse.json({ error: "Contract negăsit" }, { status: 404 });

  if (contract.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Contractul nu este în stare de draft. Nu poate fi editat.", status: contract.status },
      { status: 403 }
    );
  }

  const vars = contract.variables as Record<string, unknown>;
  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    variables[k] = typeof v === "string" ? v : String(v ?? "");
  }
  const firstSigner = contract.signers[0];

  return NextResponse.json({
    contractId: contract.id,
    templateId: contract.templateId,
    templateName: contract.template.name,
    status: contract.status,
    variables,
    signerFullName: firstSigner?.fullName ?? "",
    signerEmail: firstSigner?.email ?? "",
    signerRole: firstSigner?.role ?? "student",
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const storageProvider = new LocalStorageProvider();
  try {
    const { contract, signers } = await updateDraftContract({
      prisma,
      storageProvider,
      contractId: id,
      variables: parsed.data.variables,
      signers: parsed.data.signers,
    });
    return NextResponse.json({
      success: true,
      contractId: contract.id,
      signingLinks: signers.map((s) => ({
        signerId: s.id,
        email: s.email,
        signingLink: s.signingLink,
      })),
    });
  } catch (e) {
    if (e instanceof TemplateNotFoundError) {
      return NextResponse.json({ error: "Contract negăsit" }, { status: 404 });
    }
    if (e instanceof TemplateRenderError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof ContractSignedError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof StorageError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const message = e instanceof Error ? e.message : "Eroare la salvare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
