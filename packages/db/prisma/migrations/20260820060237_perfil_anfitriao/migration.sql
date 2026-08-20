-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "profileUserId" UUID,
ALTER COLUMN "contentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "hostUserId" UUID;

-- CreateTable
CREATE TABLE "profile_reactions" (
    "id" UUID NOT NULL,
    "profileUserId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_reactions_profileUserId_idx" ON "profile_reactions"("profileUserId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_reactions_profileUserId_userId_type_key" ON "profile_reactions"("profileUserId", "userId", "type");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_reactions" ADD CONSTRAINT "profile_reactions_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_reactions" ADD CONSTRAINT "profile_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
