-- CreateIndex
CREATE INDEX "FileActivity_listingFileId_idx" ON "FileActivity"("listingFileId");

-- CreateIndex
CREATE INDEX "FileActivity_transactionFileId_idx" ON "FileActivity"("transactionFileId");

-- CreateIndex
CREATE INDEX "FileChecklistItem_listingFileId_idx" ON "FileChecklistItem"("listingFileId");

-- CreateIndex
CREATE INDEX "FileChecklistItem_transactionFileId_idx" ON "FileChecklistItem"("transactionFileId");

-- CreateIndex
CREATE INDEX "FileCondition_transactionFileId_idx" ON "FileCondition"("transactionFileId");

-- CreateIndex
CREATE INDEX "FileDocument_listingFileId_idx" ON "FileDocument"("listingFileId");

-- CreateIndex
CREATE INDEX "FileDocument_transactionFileId_idx" ON "FileDocument"("transactionFileId");

-- CreateIndex
CREATE INDEX "FileParty_listingFileId_idx" ON "FileParty"("listingFileId");

-- CreateIndex
CREATE INDEX "FileParty_transactionFileId_idx" ON "FileParty"("transactionFileId");

-- CreateIndex
CREATE INDEX "FileTask_listingFileId_idx" ON "FileTask"("listingFileId");

-- CreateIndex
CREATE INDEX "FileTask_transactionFileId_idx" ON "FileTask"("transactionFileId");

-- CreateIndex
CREATE INDEX "LeadTask_leadId_idx" ON "LeadTask"("leadId");

-- CreateIndex
CREATE INDEX "LeadTask_done_dueDate_idx" ON "LeadTask"("done", "dueDate");
