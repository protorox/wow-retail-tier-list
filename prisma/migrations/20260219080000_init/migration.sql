-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('MYTHIC_PLUS', 'RAID');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DPS', 'TANK', 'HEALER');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('S', 'A_PLUS', 'A', 'B_PLUS', 'B', 'C');

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecScore" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "role" "Role" NOT NULL,
    "className" TEXT NOT NULL,
    "specName" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "tier" "Tier" NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "previousRank" INTEGER,
    "rawJson" JSONB,

    CONSTRAINT "SpecScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecBuild" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "role" "Role" NOT NULL,
    "className" TEXT NOT NULL,
    "specName" TEXT NOT NULL,
    "buildJson" JSONB NOT NULL,
    "buildSource" TEXT NOT NULL,
    "buildImportStringNullable" TEXT,

    CONSTRAINT "SpecBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecStats" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "role" "Role" NOT NULL,
    "className" TEXT NOT NULL,
    "specName" TEXT NOT NULL,
    "statsJson" JSONB NOT NULL,

    CONSTRAINT "SpecStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "configJson" JSONB NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "itemsUpdated" INTEGER,
    "mode" "Mode",
    "errorMessage" TEXT,
    "metadataJson" JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_mode_createdAt_idx" ON "Snapshot"("mode", "createdAt");

-- CreateIndex
CREATE INDEX "SpecScore_snapshotId_role_rank_idx" ON "SpecScore"("snapshotId", "role", "rank");

-- CreateIndex
CREATE INDEX "SpecScore_mode_role_score_idx" ON "SpecScore"("mode", "role", "score");

-- CreateIndex
CREATE UNIQUE INDEX "SpecScore_snapshotId_mode_role_className_specName_key" ON "SpecScore"("snapshotId", "mode", "role", "className", "specName");

-- CreateIndex
CREATE INDEX "SpecBuild_snapshotId_mode_role_idx" ON "SpecBuild"("snapshotId", "mode", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SpecBuild_snapshotId_mode_role_className_specName_key" ON "SpecBuild"("snapshotId", "mode", "role", "className", "specName");

-- CreateIndex
CREATE INDEX "SpecStats_snapshotId_mode_role_idx" ON "SpecStats"("snapshotId", "mode", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SpecStats_snapshotId_mode_role_className_specName_key" ON "SpecStats"("snapshotId", "mode", "role", "className", "specName");

-- CreateIndex
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");

-- AddForeignKey
ALTER TABLE "SpecScore" ADD CONSTRAINT "SpecScore_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecBuild" ADD CONSTRAINT "SpecBuild_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecStats" ADD CONSTRAINT "SpecStats_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
