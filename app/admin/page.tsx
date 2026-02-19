import { AdminPanel } from "@/components/admin/admin-panel";
import { getRawAppConfigJson } from "@/src/server/config/store";
import { getLatestJobRuns } from "@/src/server/db/queries";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [config, logs] = await Promise.all([getRawAppConfigJson(), getLatestJobRuns(40)]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[var(--font-heading)] text-2xl font-bold">Admin</h2>
        <p className="text-sm text-muted-foreground">
          Protected by basic auth. Trigger refresh jobs and edit scoring/tier config.
        </p>
      </div>

      <AdminPanel
        initialConfig={config}
        initialLogs={logs.map((run) => ({
          id: run.id,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
          status: run.status,
          durationMs: run.durationMs,
          itemsUpdated: run.itemsUpdated,
          mode: run.mode,
          errorMessage: run.errorMessage
        }))}
      />
    </div>
  );
}
