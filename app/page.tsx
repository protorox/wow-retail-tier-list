import Link from "next/link";
import { Mode, Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierPage } from "@/components/tier/tier-page";
import { getLatestSnapshotView } from "@/src/server/db/queries";

export const dynamic = "force-dynamic";

function parseMode(value: string | undefined): Mode {
  return value === "RAID" ? Mode.RAID : Mode.MYTHIC_PLUS;
}

function parseRole(value: string | undefined): Role {
  if (value === "TANK") return Role.TANK;
  if (value === "HEALER") return Role.HEALER;
  return Role.DPS;
}

export default async function Home({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mode = parseMode(Array.isArray(params.mode) ? params.mode[0] : params.mode);
  const role = parseRole(Array.isArray(params.role) ? params.role[0] : params.role);

  const snapshot = await getLatestSnapshotView(mode);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-lg border bg-white p-1">
            <Link
              href="/?mode=MYTHIC_PLUS"
              className={`rounded-md px-4 py-1.5 text-sm ${
                mode === Mode.MYTHIC_PLUS ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              Mythic+
            </Link>
            <Link
              href="/?mode=RAID"
              className={`rounded-md px-4 py-1.5 text-sm ${
                mode === Mode.RAID ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              Raid
            </Link>
          </div>
        </CardContent>
      </Card>

      {!snapshot ? (
        <Card>
          <CardHeader>
            <CardTitle>No snapshots available yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Start the worker and run a refresh from the admin page, or wait for the scheduled job.
            </p>
            <Link href="/admin" className="text-sm underline">
              Open admin page
            </Link>
          </CardContent>
        </Card>
      ) : (
        <TierPage
          initialRole={role}
          snapshot={{
            snapshotId: snapshot.snapshotId,
            mode: snapshot.mode,
            createdAt: snapshot.createdAt.toISOString(),
            metadataJson: snapshot.metadataJson,
            specs: snapshot.specs
          }}
        />
      )}
    </div>
  );
}
