-- AlterTable
ALTER TABLE "User" ADD COLUMN "company" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "label" TEXT NOT NULL DEFAULT 'local';
