-- Replace editable document drafts with immutable exported files.
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_authorId_fkey";
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_categoryId_fkey";
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_personnelId_fkey";
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_templateId_fkey";
DROP TABLE IF EXISTS "Document";

CREATE TABLE "ExportedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportedFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExportedFile_userId_createdAt_idx" ON "ExportedFile"("userId", "createdAt");
CREATE INDEX "ExportedFile_templateId_idx" ON "ExportedFile"("templateId");
ALTER TABLE "ExportedFile" ADD CONSTRAINT "ExportedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportedFile" ADD CONSTRAINT "ExportedFile_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
