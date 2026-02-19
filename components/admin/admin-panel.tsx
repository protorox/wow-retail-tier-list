"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type JobRunView = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  durationMs: number | null;
  itemsUpdated: number | null;
  mode: string | null;
  errorMessage: string | null;
};

export function AdminPanel({
  initialConfig,
  initialLogs
}: {
  initialConfig: unknown;
  initialLogs: JobRunView[];
}) {
  const [configText, setConfigText] = useState(JSON.stringify(initialConfig, null, 2));
  const [logs, setLogs] = useState<JobRunView[]>(initialLogs);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const prettyCount = useMemo(() => logs.length, [logs.length]);

  async function triggerRefresh(mode: "ALL" | "MYTHIC_PLUS" | "RAID") {
    setBusy(true);
    setStatus("Queueing refresh job...");

    const response = await fetch("/api/admin/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    });

    if (!response.ok) {
      setStatus("Failed to enqueue refresh job");
      setBusy(false);
      return;
    }

    setStatus(`Refresh job queued (${mode})`);
    setBusy(false);
  }

  async function saveConfig() {
    setBusy(true);

    let parsed: unknown;
    try {
      parsed = JSON.parse(configText);
    } catch {
      setStatus("Config JSON is invalid");
      setBusy(false);
      return;
    }

    const response = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: parsed })
    });

    const payload = await response.json();

    if (!response.ok) {
      setStatus(`Config update failed: ${(payload.errors ?? ["Unknown error"]).join(" | ")}`);
      setBusy(false);
      return;
    }

    setStatus("Config saved");
    setBusy(false);
  }

  async function refreshLogs() {
    const response = await fetch("/api/admin/logs", { method: "GET" });
    if (!response.ok) return;

    const payload = (await response.json()) as { logs: JobRunView[] };
    setLogs(payload.logs);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>AppConfig JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="h-[420px] w-full rounded-md border bg-white p-3 text-xs code-font"
            value={configText}
            onChange={(event) => setConfigText(event.target.value)}
          />
          <div className="flex gap-2">
            <Button disabled={busy} onClick={saveConfig}>
              Save Config
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => triggerRefresh("ALL")}>
              Trigger Full Refresh
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => triggerRefresh("MYTHIC_PLUS")}>
              Mythic+ Only
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => triggerRefresh("RAID")}>
              Raid Only
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{status || "No pending actions"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Refresh Logs ({prettyCount})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" onClick={refreshLogs}>
            Reload Logs
          </Button>
          <div className="max-h-[500px] space-y-2 overflow-auto">
            {logs.map((run) => (
              <div key={run.id} className="rounded-md border bg-white p-2 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold uppercase">{run.status}</span>
                  <span>{run.mode ?? "ALL"}</span>
                </div>
                <div>Started: {new Date(run.startedAt).toLocaleString()}</div>
                <div>Duration: {run.durationMs ?? 0} ms</div>
                <div>Items updated: {run.itemsUpdated ?? 0}</div>
                {run.errorMessage && <div className="text-rose-700">Error: {run.errorMessage}</div>}
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No logs yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
