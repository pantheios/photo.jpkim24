-- CreateTable
CREATE TABLE "MediaChild" (
    "mediaId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,

    PRIMARY KEY ("mediaId", "childId"),
    CONSTRAINT "MediaChild_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MediaChild_childId_idx" ON "MediaChild"("childId");
