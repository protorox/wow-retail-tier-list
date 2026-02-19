import { NextRequest, NextResponse } from "next/server";
import { enqueueRefreshJob } from "@/src/server/queue/queue";
import { logger } from "@/src/server/logger";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const mode = payload?.mode ?? request.nextUrl.searchParams.get("mode") ?? "ALL";

  await enqueueRefreshJob({
    mode,
    trigger: "manual"
  });

  logger.info({ mode }, "Refresh job enqueued via /api/refresh");

  return NextResponse.json({ ok: true, enqueued: true, mode });
}
