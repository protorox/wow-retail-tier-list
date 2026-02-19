import { Mode } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getLatestSnapshotView } from "@/src/server/db/queries";

export async function GET(request: NextRequest) {
  const modeParam = request.nextUrl.searchParams.get("mode") ?? "MYTHIC_PLUS";
  const mode = modeParam === "RAID" ? Mode.RAID : Mode.MYTHIC_PLUS;

  const snapshot = await getLatestSnapshotView(mode);

  if (!snapshot) {
    return NextResponse.json({
      mode,
      snapshot: null,
      message: "No snapshots available yet"
    });
  }

  return NextResponse.json({
    mode,
    snapshot
  });
}
