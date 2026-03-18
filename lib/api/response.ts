import { NextResponse } from "next/server";

export function success<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(e: unknown) {
  const message = e instanceof Error ? e.message : "Internal server error";
  console.error("[API Error]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}
