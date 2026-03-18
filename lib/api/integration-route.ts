import { NextResponse } from "next/server";
import { serverError } from "./response";

export function mapIntegrationActionError(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "Invalid API key") {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (msg === "Template not found" || msg === "Contract not found" || msg === "Parent contract not found") {
    return NextResponse.json({ error: msg }, { status: 404 });
  }
  return serverError(e);
}
