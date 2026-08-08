-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('TEXT', 'RICH_TEXT', 'AUDIO', 'VIDEO', 'IMAGE', 'EMBED', 'LINK');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'WHATSAPP', 'GOOGLE', 'DIRECT', 'QR_CODE', 'PRODUTO_VIVO', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "ShortLinkKind" AS ENUM ('CONTENT_QR', 'CAMPAIGN', 'SHARE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SESSION_START', 'PAGE_VIEW', 'CONTENT_VIEW', 'QR_SCAN', 'CONSENT_GIVEN', 'CONSENT_REVOKED', 'SIGNUP', 'LOGIN', 'LOGOUT', 'MEDIA_PLAY', 'MEDIA_PROGRESS', 'MEDIA_COMPLETE', 'LIKE', 'UNLIKE', 'COMMENT', 'COMMENT_DELETED', 'SHARE_CREATED', 'SHARE_LINK_CLICKED', 'PROFILE_VIEW', 'CHECKOUT_CLICKED', 'PURCHASE_COMPLETED', 'PURCHASE_REFUNDED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "MetricDimension" AS ENUM ('TOTAL', 'PLATFORM', 'CAMPAIGN', 'CONTENT');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "launchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "coverUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "type" "BlockType" NOT NULL,
    "label" TEXT,
    "text" TEXT,
    "assetId" UUID,
    "url" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationMs" INTEGER,
    "title" TEXT,
    "altText" TEXT,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_metadata" (
    "contentId" UUID NOT NULL,
    "platform" "Platform",
    "format" TEXT,
    "theme" TEXT,
    "productRef" TEXT,
    "campaignId" UUID,
    "cta" TEXT,
    "testVariant" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_metadata_pkey" PRIMARY KEY ("contentId")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT,
    "theme" TEXT,
    "cta" TEXT,
    "testVariant" TEXT,
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_links" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ShortLinkKind" NOT NULL,
    "contentId" UUID,
    "campaignId" UUID,
    "createdByUserId" UUID,
    "channel" "Platform",
    "parentShortLinkId" UUID,
    "rootShortLinkId" UUID,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "rootPlatform" "Platform",
    "targetUrl" TEXT NOT NULL,
    "qrSvg" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "short_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "anonId" TEXT NOT NULL,
    "userId" UUID,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstTouchPlatform" "Platform",
    "firstTouchSource" TEXT,
    "firstTouchMedium" TEXT,
    "firstTouchCampaignId" UUID,
    "firstTouchLinkId" UUID,
    "firstTouchAt" TIMESTAMP(3),
    "lastTouchPlatform" "Platform",
    "lastTouchSource" TEXT,
    "lastTouchMedium" TEXT,
    "lastTouchCampaignId" UUID,
    "lastTouchLinkId" UUID,
    "lastTouchAt" TIMESTAMP(3),
    "rootPlatform" "Platform",
    "rootCampaignId" UUID,
    "rootLinkId" UUID,
    "rootVisitorId" UUID,
    "acquiredViaLinkId" UUID,
    "referredByUserId" UUID,
    "chainDepth" INTEGER NOT NULL DEFAULT 0,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consentAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceType" TEXT,
    "countryCode" VARCHAR(2),

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_sessions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "userId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "entryPlatform" "Platform",
    "entryCampaignId" UUID,
    "entryLinkId" UUID,
    "landingPath" TEXT,

    CONSTRAINT "visit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" UUID NOT NULL,
    "type" "EventType" NOT NULL,
    "visitorId" UUID NOT NULL,
    "userId" UUID,
    "sessionId" UUID,
    "contentId" UUID,
    "platform" "Platform",
    "source" TEXT,
    "medium" TEXT,
    "campaignId" UUID,
    "campaignRef" TEXT,
    "shortLinkId" UUID,
    "parentShortLinkId" UUID,
    "rootShortLinkId" UUID,
    "rootPlatform" "Platform",
    "chainDepth" INTEGER NOT NULL DEFAULT 0,
    "productRef" TEXT,
    "value" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "externalOrderRef" TEXT,
    "props" JSONB NOT NULL DEFAULT '{}',
    "path" TEXT,
    "referrerHost" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceType" TEXT,
    "countryCode" VARCHAR(2),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "parentId" UUID,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shortLinkId" UUID NOT NULL,
    "channel" "Platform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_stats" (
    "contentId" UUID NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "shareClicks" INTEGER NOT NULL DEFAULT 0,
    "qrScans" INTEGER NOT NULL DEFAULT 0,
    "recomputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_stats_pkey" PRIMARY KEY ("contentId")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "dimension" "MetricDimension" NOT NULL,
    "dimKey" TEXT,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "contentViews" INTEGER NOT NULL DEFAULT 0,
    "qrScans" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "shareClicks" INTEGER NOT NULL DEFAULT 0,
    "visitorsFromShares" INTEGER NOT NULL DEFAULT 0,
    "signupsFromShares" INTEGER NOT NULL DEFAULT 0,
    "checkoutClicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "purchasesFromShares" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_snapshots" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "platform" "Platform" NOT NULL,
    "followers" INTEGER,
    "reach" INTEGER,
    "notes" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baseline_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "userId" UUID,
    "policyVersion" TEXT NOT NULL,
    "purposes" JSONB NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "contents_projectId_status_position_idx" ON "contents"("projectId", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "contents_projectId_slug_key" ON "contents"("projectId", "slug");

-- CreateIndex
CREATE INDEX "content_blocks_contentId_position_idx" ON "content_blocks"("contentId", "position");

-- CreateIndex
CREATE INDEX "content_metadata_platform_idx" ON "content_metadata"("platform");

-- CreateIndex
CREATE INDEX "content_metadata_theme_idx" ON "content_metadata"("theme");

-- CreateIndex
CREATE INDEX "content_metadata_testVariant_idx" ON "content_metadata"("testVariant");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_code_key" ON "campaigns"("code");

-- CreateIndex
CREATE INDEX "campaigns_projectId_platform_idx" ON "campaigns"("projectId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "short_links_code_key" ON "short_links"("code");

-- CreateIndex
CREATE INDEX "short_links_projectId_kind_idx" ON "short_links"("projectId", "kind");

-- CreateIndex
CREATE INDEX "short_links_rootShortLinkId_idx" ON "short_links"("rootShortLinkId");

-- CreateIndex
CREATE INDEX "short_links_parentShortLinkId_idx" ON "short_links"("parentShortLinkId");

-- CreateIndex
CREATE INDEX "short_links_createdByUserId_idx" ON "short_links"("createdByUserId");

-- CreateIndex
CREATE INDEX "short_links_contentId_idx" ON "short_links"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "visitors_anonId_key" ON "visitors"("anonId");

-- CreateIndex
CREATE INDEX "visitors_projectId_firstSeenAt_idx" ON "visitors"("projectId", "firstSeenAt");

-- CreateIndex
CREATE INDEX "visitors_projectId_chainDepth_idx" ON "visitors"("projectId", "chainDepth");

-- CreateIndex
CREATE INDEX "visitors_referredByUserId_idx" ON "visitors"("referredByUserId");

-- CreateIndex
CREATE INDEX "visitors_rootVisitorId_idx" ON "visitors"("rootVisitorId");

-- CreateIndex
CREATE INDEX "visitors_rootCampaignId_idx" ON "visitors"("rootCampaignId");

-- CreateIndex
CREATE INDEX "visitors_userId_idx" ON "visitors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "visit_sessions_projectId_startedAt_idx" ON "visit_sessions"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "visit_sessions_visitorId_startedAt_idx" ON "visit_sessions"("visitorId", "startedAt");

-- CreateIndex
CREATE INDEX "events_projectId_occurredAt_idx" ON "events"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "events_projectId_type_occurredAt_idx" ON "events"("projectId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "events_visitorId_occurredAt_idx" ON "events"("visitorId", "occurredAt");

-- CreateIndex
CREATE INDEX "events_userId_occurredAt_idx" ON "events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "events_contentId_occurredAt_idx" ON "events"("contentId", "occurredAt");

-- CreateIndex
CREATE INDEX "events_campaignId_occurredAt_idx" ON "events"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "events_shortLinkId_idx" ON "events"("shortLinkId");

-- CreateIndex
CREATE INDEX "events_rootShortLinkId_idx" ON "events"("rootShortLinkId");

-- CreateIndex
CREATE INDEX "events_platform_occurredAt_idx" ON "events"("platform", "occurredAt");

-- CreateIndex
CREATE INDEX "events_sessionId_idx" ON "events"("sessionId");

-- CreateIndex
CREATE INDEX "reactions_contentId_idx" ON "reactions"("contentId");

-- CreateIndex
CREATE INDEX "reactions_userId_idx" ON "reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_contentId_userId_type_key" ON "reactions"("contentId", "userId", "type");

-- CreateIndex
CREATE INDEX "comments_contentId_createdAt_idx" ON "comments"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "shares_userId_createdAt_idx" ON "shares"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "shares_shortLinkId_idx" ON "shares"("shortLinkId");

-- CreateIndex
CREATE INDEX "daily_metrics_projectId_date_idx" ON "daily_metrics"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_projectId_date_dimension_dimKey_key" ON "daily_metrics"("projectId", "date", "dimension", "dimKey");

-- CreateIndex
CREATE INDEX "baseline_snapshots_projectId_capturedAt_idx" ON "baseline_snapshots"("projectId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_snapshots_projectId_label_platform_key" ON "baseline_snapshots"("projectId", "label", "platform");

-- CreateIndex
CREATE INDEX "consents_visitorId_grantedAt_idx" ON "consents"("visitorId", "grantedAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_projectId_createdAt_idx" ON "admin_audit_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_userId_createdAt_idx" ON "admin_audit_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_metadata" ADD CONSTRAINT "content_metadata_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_metadata" ADD CONSTRAINT "content_metadata_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_parentShortLinkId_fkey" FOREIGN KEY ("parentShortLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_rootShortLinkId_fkey" FOREIGN KEY ("rootShortLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_firstTouchCampaignId_fkey" FOREIGN KEY ("firstTouchCampaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_firstTouchLinkId_fkey" FOREIGN KEY ("firstTouchLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_lastTouchCampaignId_fkey" FOREIGN KEY ("lastTouchCampaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_lastTouchLinkId_fkey" FOREIGN KEY ("lastTouchLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_rootCampaignId_fkey" FOREIGN KEY ("rootCampaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_rootLinkId_fkey" FOREIGN KEY ("rootLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_acquiredViaLinkId_fkey" FOREIGN KEY ("acquiredViaLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_entryCampaignId_fkey" FOREIGN KEY ("entryCampaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_entryLinkId_fkey" FOREIGN KEY ("entryLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "visit_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_parentShortLinkId_fkey" FOREIGN KEY ("parentShortLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_rootShortLinkId_fkey" FOREIGN KEY ("rootShortLinkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "short_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_stats" ADD CONSTRAINT "content_stats_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_snapshots" ADD CONSTRAINT "baseline_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
