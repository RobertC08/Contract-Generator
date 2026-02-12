import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: Date): string {
  return new Date(d).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  if (!contractId) {
    return new NextResponse("Contract ID required", { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      signers: { orderBy: { signingOrder: "asc" } },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        include: { signer: { select: { fullName: true, email: true, role: true } } },
      },
    },
  });

  if (!contract) {
    return new NextResponse("Contract not found", { status: 404 });
  }

  const rows = contract.auditLogs.map(
    (log) => `
    <tr>
      <td>${escapeHtml(formatDate(log.createdAt))}</td>
      <td>${escapeHtml(log.signer.fullName)}</td>
      <td>${escapeHtml(log.signer.email)}</td>
      <td>${escapeHtml(log.signer.role)}</td>
      <td>${escapeHtml(log.ip ?? "—")}</td>
      <td>${escapeHtml(log.device ?? "—")}</td>
      <td>${escapeHtml(log.deviceSignature ?? "—")}</td>
      <td>${escapeHtml(log.authMethod)}</td>
      <td>${escapeHtml(log.documentHash ?? "—")}</td>
    </tr>`
  ).join("");

  const signersRows = contract.signers.map(
    (s) => `
    <tr>
      <td>${escapeHtml(s.fullName)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.role)}</td>
      <td>${s.signedAt ? escapeHtml(formatDate(s.signedAt)) : "—"}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Raport audit semnătură – Contract ${escapeHtml(contractId)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .meta { font-size: 0.875rem; color: #555; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.8125rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .section { margin-bottom: 2rem; }
    .section h2 { font-size: 1rem; margin-bottom: 0.75rem; }
    @media print { body { margin: 1rem; } }
  </style>
</head>
<body>
  <h1>Raport de audit – Semnătură electronică</h1>
  <div class="meta">
    Contract ID: ${escapeHtml(contractId)}<br>
    Status: ${escapeHtml(contract.status)}<br>
    Hash document (SHA-256): ${escapeHtml(contract.documentHash ?? "—")}<br>
    Versiune template: ${contract.templateVersion ?? "—"}<br>
    Data creării contract: ${formatDate(contract.createdAt)}<br>
    Raport generat: ${formatDate(new Date())}
  </div>

  <div class="section">
    <h2>Semnatari</h2>
    <table>
      <thead><tr><th>Nume</th><th>Email</th><th>Rol</th><th>Data semnăturii (UTC)</th></tr></thead>
      <tbody>${signersRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Jurnal evenimente (audit trail)</h2>
    <p>Fiecare înregistrare corespunde unei acțiuni de semnare: identitate, IP, dispozitiv, semnătură dispozitiv, metodă de autentificare, hash document.</p>
    <table>
      <thead>
        <tr>
          <th>Data (UTC)</th>
          <th>Semnatar</th>
          <th>Email</th>
          <th>Rol</th>
          <th>IP</th>
          <th>Dispozitiv</th>
          <th>Semnătură dispozitiv</th>
          <th>Autentificare</th>
          <th>Hash document</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <p style="font-size: 0.75rem; color: #666;">
    Acest raport poate fi salvat ca PDF din browser (Ctrl+P / Cmd+P → Salvează ca PDF) și păstrat ca probă în caz de litigiu.
  </p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="audit-contract-${contractId}.html"`,
    },
  });
}
