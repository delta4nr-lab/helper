-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "signaturePath" TEXT,
ALTER COLUMN "unit" DROP NOT NULL;
