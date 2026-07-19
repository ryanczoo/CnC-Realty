-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignContact_leadId_idx" ON "CampaignContact"("leadId");

-- CreateIndex
CREATE INDEX "ListingFile_agentId_idx" ON "ListingFile"("agentId");

-- CreateIndex
CREATE INDEX "ListingFile_status_idx" ON "ListingFile"("status");

-- CreateIndex
CREATE INDEX "ListingFile_awaitingReview_idx" ON "ListingFile"("awaitingReview");

-- CreateIndex
CREATE INDEX "TransactionFile_agentId_idx" ON "TransactionFile"("agentId");

-- CreateIndex
CREATE INDEX "TransactionFile_status_idx" ON "TransactionFile"("status");

-- CreateIndex
CREATE INDEX "TransactionFile_awaitingReview_idx" ON "TransactionFile"("awaitingReview");
