-- CreateTable
CREATE TABLE "ContractNumberSequence" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContractNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractNumberSequence_templateId_key" ON "ContractNumberSequence"("templateId");

-- AddForeignKey
ALTER TABLE "ContractNumberSequence" ADD CONSTRAINT "ContractNumberSequence_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
