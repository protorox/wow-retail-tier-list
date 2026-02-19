import { NextResponse } from "next/server";
import { getLatestJobRuns } from "@/src/server/db/queries";

export async function GET() {
  const logs = await getLatestJobRuns(40);

  return NextResponse.json({
    logs: logs.map((run) => ({
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      status: run.status,
      durationMs: run.durationMs,
      itemsUpdated: run.itemsUpdated,
      mode: run.mode,
      errorMessage: run.errorMessage
    }))
  });
}
