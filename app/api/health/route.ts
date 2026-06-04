import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "fanbase-ng",
    timestamp: new Date().toISOString(),
  });
}
