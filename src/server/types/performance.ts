import { Mode, Role } from "@prisma/client";

export type PerformerEntry = {
  mode: Mode;
  role: Role;
  className: string;
  specName: string;
  metric: number;
  timed?: boolean;
  buildString?: string | null;
  talentNodes?: string[] | null;
  stats?: Record<string, number> | null;
  evidenceUrl: string;
  raw?: unknown;
};

export type SpecAggregate = {
  mode: Mode;
  role: Role;
  className: string;
  specName: string;
  scoreRaw: number;
  scoreNormalized: number;
  sampleSize: number;
  evidenceUrls: string[];
  rawEntries: PerformerEntry[];
};
