-- CreateTable
CREATE TABLE "DeviceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRequest_token_key" ON "DeviceRequest"("token");

-- CreateIndex
CREATE INDEX "DeviceRequest_createdAt_idx" ON "DeviceRequest"("createdAt");
