import { NextRequest, NextResponse } from "next/server";
import { enqueueRefreshJob } from "@/src/server/queue/queue";
import { logger } from "@/src/server/logger";

async function enqueueFromRequest(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const mode = payload?.mode ?? request.nextUrl.searchParams.get("mode") ?? "ALL";

  await enqueueRefreshJob({
    mode,
    trigger: "cron"
  });

  logger.info({ mode }, "Refresh job enqueued via cron endpoint");

  return NextResponse.json({ ok: true, enqueued: true, mode });
}

export async function POST(request: NextRequest) {
  return enqueueFromRequest(request);
}

export async function GET(request: NextRequest) {
  return enqueueFromRequest(request);
}
