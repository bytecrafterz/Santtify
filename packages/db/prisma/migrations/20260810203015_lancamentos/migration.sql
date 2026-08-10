-- CreateEnum
CREATE TYPE "LaunchStatus" AS ENUM ('EM_BREVE', 'EM_DESENVOLVIMENTO', 'LANCADO');

-- CreateTable
CREATE TABLE "launches" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "status" "LaunchStatus" NOT NULL DEFAULT 'EM_BREVE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "externalUrl" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launches_projectId_visible_position_idx" ON "launches"("projectId", "visible", "position");

-- AddForeignKey
ALTER TABLE "launches" ADD CONSTRAINT "launches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
