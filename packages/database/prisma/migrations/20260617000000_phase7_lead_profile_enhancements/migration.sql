-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'HOT_PROSPECT';
ALTER TYPE "LeadStatus" ADD VALUE 'NURTURE';
ALTER TYPE "LeadStatus" ADD VALUE 'SPHERE';

-- AlterTable: Lead model — add 4 new fields
ALTER TABLE "Lead" ADD COLUMN "priceMin" DOUBLE PRECISION,
                   ADD COLUMN "priceMax" DOUBLE PRECISION,
                   ADD COLUMN "timeframeToMove" TEXT,
                   ADD COLUMN "lastContactedAt" TIMESTAMP(3);

-- CreateTable: Tag
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#9E8C61',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeadTag
CREATE TABLE "LeadTag" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateTable: LeadRelationship
CREATE TABLE "LeadRelationship" (
    "id" TEXT NOT NULL,
    "fromLeadId" TEXT NOT NULL,
    "toLeadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeadTask
CREATE TABLE "LeadTask" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'FOLLOW_UP',
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PropertyView
CREATE TABLE "PropertyView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mlsNumber" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyView_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomFieldDef
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "hideIfEmpty" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomFieldValue
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "customFieldDefId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Tag.name unique
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex: LeadRelationship unique pair
CREATE UNIQUE INDEX "LeadRelationship_fromLeadId_toLeadId_key" ON "LeadRelationship"("fromLeadId", "toLeadId");

-- CreateIndex: PropertyView indexes
CREATE INDEX "PropertyView_userId_idx" ON "PropertyView"("userId");
CREATE INDEX "PropertyView_mlsNumber_idx" ON "PropertyView"("mlsNumber");

-- CreateIndex: CustomFieldValue unique per def+lead
CREATE UNIQUE INDEX "CustomFieldValue_customFieldDefId_leadId_key" ON "CustomFieldValue"("customFieldDefId", "leadId");

-- AddForeignKey: LeadTag.leadId -> Lead
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LeadTag.tagId -> Tag
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LeadRelationship.fromLeadId -> Lead
ALTER TABLE "LeadRelationship" ADD CONSTRAINT "LeadRelationship_fromLeadId_fkey"
    FOREIGN KEY ("fromLeadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LeadRelationship.toLeadId -> Lead
ALTER TABLE "LeadRelationship" ADD CONSTRAINT "LeadRelationship_toLeadId_fkey"
    FOREIGN KEY ("toLeadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LeadTask.leadId -> Lead
ALTER TABLE "LeadTask" ADD CONSTRAINT "LeadTask_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LeadTask.assigneeId -> Agent
ALTER TABLE "LeadTask" ADD CONSTRAINT "LeadTask_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PropertyView.userId -> User
ALTER TABLE "PropertyView" ADD CONSTRAINT "PropertyView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CustomFieldValue.customFieldDefId -> CustomFieldDef
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customFieldDefId_fkey"
    FOREIGN KEY ("customFieldDefId") REFERENCES "CustomFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CustomFieldValue.leadId -> Lead
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
