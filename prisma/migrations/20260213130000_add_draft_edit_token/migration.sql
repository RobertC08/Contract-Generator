ALTER TABLE "Contract" ADD COLUMN "draftEditToken" TEXT;
CREATE UNIQUE INDEX "Contract_draftEditToken_key" ON "Contract"("draftEditToken") WHERE "draftEditToken" IS NOT NULL;
