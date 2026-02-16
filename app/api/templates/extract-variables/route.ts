import { NextRequest, NextResponse } from "next/server";
import { extractVariableNamesFromDocx } from "@/lib/contracts/docx-generator";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "Fișier DOCX obligatoriu" }, { status: 400 });
  }
  const ok =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx");
  if (!ok) {
    return NextResponse.json({ message: "Doar fișiere .docx" }, { status: 400 });
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const variableNames = extractVariableNamesFromDocx(buffer);
    return NextResponse.json({ variableNames });
  } catch {
    return NextResponse.json({ message: "Eroare la citirea documentului" }, { status: 500 });
  }
}
