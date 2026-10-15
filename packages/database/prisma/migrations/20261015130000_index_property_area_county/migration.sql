-- Built after the area backfill so each index is written once.
CREATE INDEX "Property_county_idx" ON "Property"("county");
CREATE INDEX "Property_area_trgm_idx" ON "Property" USING GIN ("area" gin_trgm_ops);
