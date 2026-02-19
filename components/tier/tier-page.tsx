"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Minus } from "lucide-react";
import { Mode, Role, Tier } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { resolveClassColor } from "@/src/server/config/class-colors";
import { formatRelativeRankChange } from "@/src/lib/utils";

type SnapshotPayload = {
  snapshotId: string;
  mode: Mode;
  createdAt: string;
  metadataJson?: unknown;
  specs: Array<{
    id: string;
    mode: Mode;
    role: Role;
    className: string;
    specName: string;
    score: number;
    tier: Tier;
    sampleSize: number;
    rank: number;
    previousRank: number | null;
    rawJson: unknown;
    build: unknown;
    buildSource: string | null;
    buildImportString: string | null;
    stats: unknown;
  }>;
};

const tierOrder: Tier[] = [Tier.S, Tier.A_PLUS, Tier.A, Tier.B_PLUS, Tier.B, Tier.C];
const tierLabels: Record<Tier, string> = {
  S: "S",
  A_PLUS: "A+",
  A: "A",
  B_PLUS: "B+",
  B: "B",
  C: "C"
};

const roleLabels: Record<Role, string> = {
  DPS: "DPS",
  TANK: "Tank",
  HEALER: "Healer"
};

function RankDelta({ previousRank, rank }: { previousRank: number | null; rank: number }) {
  const delta = formatRelativeRankChange(previousRank, rank);

  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <ArrowUp className="h-3 w-3" />+{delta}
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600">
        <ArrowDown className="h-3 w-3" />{delta}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

function parseEvidenceUrls(rawJson: unknown): string[] {
  if (!rawJson || typeof rawJson !== "object") return [];
  const urls = (rawJson as { evidenceUrls?: unknown }).evidenceUrls;
  if (!Array.isArray(urls)) return [];
  return urls.filter((url): url is string => typeof url === "string");
}

export function TierPage({ snapshot, initialRole }: { snapshot: SnapshotPayload; initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const lowSampleThreshold = useMemo(() => {
    if (!snapshot.metadataJson || typeof snapshot.metadataJson !== "object") return 20;
    const candidate = (snapshot.metadataJson as { minSampleSize?: unknown }).minSampleSize;
    return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 20;
  }, [snapshot.metadataJson]);

  const selectedSpec = snapshot.specs.find((spec) => spec.id === selectedSpecId) ?? null;

  const grouped = useMemo(() => {
    const roleSpecs = snapshot.specs.filter((spec) => spec.role === role);
    const map: Record<Tier, typeof roleSpecs> = {
      S: [],
      A_PLUS: [],
      A: [],
      B_PLUS: [],
      B: [],
      C: []
    };

    for (const spec of roleSpecs) {
      map[spec.tier].push(spec);
    }

    tierOrder.forEach((tier) => {
      map[tier].sort((a, b) => a.rank - b.rank);
    });

    return map;
  }, [snapshot.specs, role]);

  async function handleCopy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-[var(--font-heading)] text-2xl font-bold">
            {snapshot.mode === Mode.MYTHIC_PLUS ? "Mythic+" : "Raid"}
          </h2>
          <p className="text-sm text-muted-foreground">Last updated: {new Date(snapshot.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <Tabs value={role} onValueChange={(value) => setRole(value as Role)}>
        <TabsList className="mb-4 grid w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value={Role.DPS}>{roleLabels[Role.DPS]}</TabsTrigger>
          <TabsTrigger value={Role.TANK}>{roleLabels[Role.TANK]}</TabsTrigger>
          <TabsTrigger value={Role.HEALER}>{roleLabels[Role.HEALER]}</TabsTrigger>
        </TabsList>

        {[Role.DPS, Role.TANK, Role.HEALER].map((roleValue) => (
          <TabsContent key={roleValue} value={roleValue}>
            <div className="space-y-4">
              {tierOrder.map((tier) => (
                <Card key={tier} className="overflow-hidden border-l-[6px] border-l-slate-300">
                  <CardContent className="pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-[var(--font-heading)] text-lg font-semibold">Tier {tierLabels[tier]}</h3>
                      <span className="text-xs text-muted-foreground">{grouped[tier].length} specs</span>
                    </div>

                    {grouped[tier].length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No specs in this tier.</div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {grouped[tier].map((spec) => (
                          <button
                            key={spec.id}
                            onClick={() => setSelectedSpecId(spec.id)}
                            className="rounded-lg border bg-white p-3 text-left transition hover:border-primary/40 hover:shadow-sm"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: resolveClassColor(spec.className) }}
                                />
                                <span className="font-semibold">
                                  {spec.specName} {spec.className}
                                </span>
                                {spec.sampleSize < lowSampleThreshold && (
                                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                    Low sample
                                  </span>
                                )}
                              </div>
                              <span className="rounded bg-secondary px-2 py-0.5 text-xs">#{spec.rank}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>Score: {spec.score.toFixed(2)}</span>
                              <RankDelta previousRank={spec.previousRank} rank={spec.rank} />
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">Sample size: {spec.sampleSize}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Drawer open={Boolean(selectedSpec)} onOpenChange={(open) => !open && setSelectedSpecId(null)}>
        {selectedSpec && (
          <DrawerContent>
            <DrawerTitle className="font-[var(--font-heading)] text-2xl font-bold">
              {selectedSpec.specName} {selectedSpec.className}
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              Score {selectedSpec.score.toFixed(2)} | Rank #{selectedSpec.rank}
              {selectedSpec.sampleSize < lowSampleThreshold ? ` | Low sample (< ${lowSampleThreshold})` : ""}
            </DrawerDescription>

            <div className="mt-6 space-y-6">
              <section className="rounded-lg border p-4">
                <h4 className="mb-2 font-[var(--font-heading)] text-lg font-semibold">Most Common Build</h4>
                {selectedSpec.build && typeof selectedSpec.build === "object" ? (
                  (() => {
                    const build = selectedSpec.build as {
                      type?: string;
                      mostCommonBuild?: string;
                      buildImportString?: string;
                      buildFrequency?: number;
                      nodePickRates?: Array<{ node: string; pickRate: number }>;
                      reason?: string;
                    };

                    if (build.type === "import_string" && build.buildImportString) {
                      return (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Frequency among top performers: {((build.buildFrequency ?? 0) * 100).toFixed(1)}%
                          </p>
                          <div className="rounded-md bg-secondary p-2 text-xs code-font break-all">{build.mostCommonBuild}</div>
                          <Button size="sm" variant="secondary" onClick={() => handleCopy(build.buildImportString as string)}>
                            <Copy className="h-3 w-3" /> Copy Import String
                          </Button>
                        </div>
                      );
                    }

                    if (build.type === "node_rates" && Array.isArray(build.nodePickRates)) {
                      return (
                        <div className="space-y-2 text-sm">
                          {build.nodePickRates.slice(0, 8).map((node) => (
                            <div key={node.node} className="flex items-center justify-between rounded bg-secondary px-2 py-1">
                              <span className="code-font text-xs">{node.node}</span>
                              <span>{(node.pickRate * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return <p className="text-sm text-muted-foreground">{build.reason ?? "Not available from source"}</p>;
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground">Not available from source</p>
                )}
              </section>

              <section className="rounded-lg border p-4">
                <h4 className="mb-2 font-[var(--font-heading)] text-lg font-semibold">Priority Stats</h4>
                {selectedSpec.stats && typeof selectedSpec.stats === "object" ? (
                  (() => {
                    const stats = selectedSpec.stats as {
                      available?: boolean;
                      priorityOrder?: string[];
                      medians?: Record<string, number>;
                      sampleSize?: number;
                      note?: string;
                    };

                    if (!stats.available) {
                      return <p className="text-sm text-muted-foreground">{stats.note ?? "Not available from source"}</p>;
                    }

                    return (
                      <div className="space-y-2 text-sm">
                        <p className="font-medium">{stats.priorityOrder?.join(" > ")}</p>
                        <p className="text-xs text-muted-foreground">
                          Data-driven from top performers (sample size: {stats.sampleSize ?? selectedSpec.sampleSize})
                        </p>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="py-1">Stat</th>
                              <th className="py-1">Median</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(stats.medians ?? {}).map(([stat, value]) => (
                              <tr key={stat} className="border-b last:border-0">
                                <td className="py-1">{stat}</td>
                                <td className="py-1">{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground">Not available from source</p>
                )}
              </section>

              <section className="rounded-lg border p-4">
                <h4 className="mb-2 font-[var(--font-heading)] text-lg font-semibold">Evidence Links</h4>
                <div className="space-y-2 text-sm">
                  {parseEvidenceUrls(selectedSpec.rawJson).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block truncate text-sky-700 underline">
                      {url}
                    </a>
                  ))}
                  {parseEvidenceUrls(selectedSpec.rawJson).length === 0 && (
                    <p className="text-muted-foreground">No evidence links were stored for this spec.</p>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Last updated: {new Date(snapshot.createdAt).toLocaleString()}</p>
              </section>
            </div>
          </DrawerContent>
        )}
      </Drawer>
    </>
  );
}
