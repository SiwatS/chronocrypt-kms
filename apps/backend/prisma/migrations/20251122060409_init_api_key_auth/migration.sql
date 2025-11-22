-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target" TEXT,
    "startTime" BIGINT,
    "endTime" BIGINT,
    "success" BOOLEAN NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_keys" (
    "id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "curve" TEXT NOT NULL,
    "publicKeyJwk" JSONB NOT NULL,
    "privateKeyJwk" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requesters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keySecret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "startTime" BIGINT NOT NULL,
    "endTime" BIGINT NOT NULL,
    "purpose" TEXT,
    "metadata" JSONB,
    "granted" BOOLEAN NOT NULL,
    "denialReason" TEXT,
    "keyCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "policies_priority_idx" ON "policies"("priority");

-- CreateIndex
CREATE INDEX "policies_enabled_idx" ON "policies"("enabled");

-- CreateIndex
CREATE INDEX "policies_type_idx" ON "policies"("type");

-- CreateIndex
CREATE INDEX "master_keys_active_idx" ON "master_keys"("active");

-- CreateIndex
CREATE INDEX "requesters_enabled_idx" ON "requesters"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyId_key" ON "api_keys"("keyId");

-- CreateIndex
CREATE INDEX "api_keys_requesterId_idx" ON "api_keys"("requesterId");

-- CreateIndex
CREATE INDEX "api_keys_enabled_idx" ON "api_keys"("enabled");

-- CreateIndex
CREATE INDEX "api_keys_keyId_idx" ON "api_keys"("keyId");

-- CreateIndex
CREATE INDEX "access_requests_requesterId_idx" ON "access_requests"("requesterId");

-- CreateIndex
CREATE INDEX "access_requests_createdAt_idx" ON "access_requests"("createdAt");

-- CreateIndex
CREATE INDEX "access_requests_granted_idx" ON "access_requests"("granted");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "requesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
