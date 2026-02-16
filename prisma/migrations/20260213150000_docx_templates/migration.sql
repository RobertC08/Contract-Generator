-- Contract: rename pdfUrl to documentUrl
ALTER TABLE "Contract" RENAME COLUMN "pdfUrl" TO "documentUrl";

-- ContractTemplate: replace content (TEXT) with fileContent (BYTEA)
ALTER TABLE "ContractTemplate" ADD COLUMN "fileContent" BYTEA;
UPDATE "ContractTemplate" SET "fileContent" = E'\\x' WHERE "fileContent" IS NULL;
ALTER TABLE "ContractTemplate" ALTER COLUMN "fileContent" SET NOT NULL;
ALTER TABLE "ContractTemplate" DROP COLUMN "content";
