import { NextRequest, NextResponse } from "next/server";

export function getBearerApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function unauthorizedResponse(message = "Missing or invalid Authorization header") {
  return NextResponse.json({ error: message }, { status: 401 });
}
