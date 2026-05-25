-- CreateTable
CREATE TABLE "VehicleLibraryImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "originalFileName" TEXT,
    "sourceFileSize" INTEGER,
    "artifactCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "batchCount" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" TEXT,
    "errorJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "VehicleLibraryArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "shopifyFileId" TEXT,
    "cdnUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehicleLibraryArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VehicleLibraryImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleLibraryVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "artifactCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleLibraryVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VehicleLibraryImportJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VehicleLibraryImportJob_shop_createdAt_idx" ON "VehicleLibraryImportJob"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleLibraryImportJob_shop_version_idx" ON "VehicleLibraryImportJob"("shop", "version");

-- CreateIndex
CREATE INDEX "VehicleLibraryImportJob_status_idx" ON "VehicleLibraryImportJob"("status");

-- CreateIndex
CREATE INDEX "VehicleLibraryArtifact_jobId_idx" ON "VehicleLibraryArtifact"("jobId");

-- CreateIndex
CREATE INDEX "VehicleLibraryArtifact_fileName_idx" ON "VehicleLibraryArtifact"("fileName");

-- CreateIndex
CREATE INDEX "VehicleLibraryArtifact_status_idx" ON "VehicleLibraryArtifact"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleLibraryVersion_shop_version_key" ON "VehicleLibraryVersion"("shop", "version");

-- CreateIndex
CREATE INDEX "VehicleLibraryVersion_shop_publishedAt_idx" ON "VehicleLibraryVersion"("shop", "publishedAt");

-- CreateIndex
CREATE INDEX "VehicleLibraryVersion_status_idx" ON "VehicleLibraryVersion"("status");
