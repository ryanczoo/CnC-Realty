-- CreateIndex
CREATE INDEX "Property_city_trgm_idx" ON "Property" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Property_address_trgm_idx" ON "Property" USING GIN ("address" gin_trgm_ops);
