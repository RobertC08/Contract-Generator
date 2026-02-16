import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSignerByTokenForDocument } from "@/lib/contracts/sign-service";
import { LocalStorageProvider } from "@/lib/storage/storage-provider";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  const signer = await getSignerByTokenForDocument(prisma, token);
  if (!signer) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }
  const documentUrl = signer.contract.documentUrl;
  if (!documentUrl) {
    return NextResponse.json({ error: "Document not available" }, { status: 404 });
  }

  let buffer: Buffer;
  if (documentUrl.startsWith("http://") || documentUrl.startsWith("https://")) {
    const res = await fetch(documentUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Document fetch failed" }, { status: 502 });
    }
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  } else {
    const storage = new LocalStorageProvider();
    if (!storage.read) {
      return NextResponse.json({ error: "Storage read not supported" }, { status: 501 });
    }
    try {
      buffer = await storage.read(documentUrl);
    } catch {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'inline; filename="contract.docx"',
    },
  });
}
