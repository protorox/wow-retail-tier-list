import { NextRequest, NextResponse } from "next/server";
import { appConfigSchema } from "@/src/server/config/app-config";
import { getRawAppConfigJson, updateAppConfig } from "@/src/server/config/store";
import { logger } from "@/src/server/logger";

export async function GET() {
  const config = await getRawAppConfigJson();
  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const candidate = body?.config ?? body;

  const parsed = appConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      },
      { status: 400 }
    );
  }

  await updateAppConfig(parsed.data);
  logger.info("App config updated from admin endpoint");

  return NextResponse.json({ ok: true });
}
