-- DropForeignKey
ALTER TABLE "content_metadata" DROP CONSTRAINT "content_metadata_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_contentId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_parentShortLinkId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_rootShortLinkId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_shortLinkId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_userId_fkey";

-- DropForeignKey
ALTER TABLE "short_links" DROP CONSTRAINT "short_links_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "short_links" DROP CONSTRAINT "short_links_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "short_links" DROP CONSTRAINT "short_links_parentShortLinkId_fkey";

-- DropForeignKey
ALTER TABLE "short_links" DROP CONSTRAINT "short_links_rootShortLinkId_fkey";

-- DropForeignKey
ALTER TABLE "visit_sessions" DROP CONSTRAINT "visit_sessions_entryCampaignId_fkey";

-- DropForeignKey
ALTER TABLE "visit_sessions" DROP CONSTRAINT "visit_sessions_entryLinkId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_acquiredViaLinkId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_firstTouchCampaignId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_firstTouchLinkId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_lastTouchCampaignId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_lastTouchLinkId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_referredByUserId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_rootCampaignId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_rootLinkId_fkey";

-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_userId_fkey";

-- AddForeignKey
ALTER TABLE "content_metadata" ADD CONSTRAINT "content_metadata_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_parentShortLinkId_fkey" FOREIGN KEY ("parentShortLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_rootShortLinkId_fkey" FOREIGN KEY ("rootShortLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_firstTouchCampaignId_fkey" FOREIGN KEY ("firstTouchCampaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_firstTouchLinkId_fkey" FOREIGN KEY ("firstTouchLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_lastTouchCampaignId_fkey" FOREIGN KEY ("lastTouchCampaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_lastTouchLinkId_fkey" FOREIGN KEY ("lastTouchLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_rootCampaignId_fkey" FOREIGN KEY ("rootCampaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_rootLinkId_fkey" FOREIGN KEY ("rootLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_acquiredViaLinkId_fkey" FOREIGN KEY ("acquiredViaLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_entryCampaignId_fkey" FOREIGN KEY ("entryCampaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_entryLinkId_fkey" FOREIGN KEY ("entryLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "visit_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_parentShortLinkId_fkey" FOREIGN KEY ("parentShortLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_rootShortLinkId_fkey" FOREIGN KEY ("rootShortLinkId") REFERENCES "short_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
