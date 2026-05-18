-- CreateIndex
CREATE INDEX "Property_status_listingType_idx" ON "Property"("status", "listingType");

-- CreateIndex
CREATE INDEX "Property_zip_idx" ON "Property"("zip");

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Property_listPrice_idx" ON "Property"("listPrice");

-- CreateIndex
CREATE INDEX "Property_beds_idx" ON "Property"("beds");

-- CreateIndex
CREATE INDEX "Property_baths_idx" ON "Property"("baths");

-- CreateIndex
CREATE INDEX "Property_listedAt_idx" ON "Property"("listedAt");

-- CreateIndex
CREATE INDEX "Property_status_listingType_listedAt_idx" ON "Property"("status", "listingType", "listedAt");
