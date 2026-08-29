/*
  Warnings:

  - You are about to drop the column `bodyTemplate` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `footerTemplate` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `headerTemplate` on the `Template` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Template" DROP COLUMN "bodyTemplate",
DROP COLUMN "footerTemplate",
DROP COLUMN "headerTemplate";
