-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "duration" TEXT NOT NULL DEFAULT '1m';
