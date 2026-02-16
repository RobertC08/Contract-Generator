-- Run this in Supabase SQL editor if migrate deploy fails (e.g. shadow DB = main DB).
-- Idempotent: safe to run if already applied.

-- Empty all app tables (order: dependents first, then ContractTemplate)
TRUNCATE TABLE "SignatureAuditLog", "SigningOtp", "Signer", "Contract", "ContractTemplate" RESTART IDENTITY CASCADE;

-- Contract: rename pdfUrl to documentUrl (skip if already done)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'pdfUrl'
  ) THEN
    ALTER TABLE "Contract" RENAME COLUMN "pdfUrl" TO "documentUrl";
  END IF;
END $$;

-- ContractTemplate: replace content (TEXT) with fileContent (BYTEA)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ContractTemplate' AND column_name = 'fileContent'
  ) THEN
    ALTER TABLE "ContractTemplate" ADD COLUMN "fileContent" BYTEA;
    UPDATE "ContractTemplate" SET "fileContent" = E'\\x' WHERE "fileContent" IS NULL;
    ALTER TABLE "ContractTemplate" ALTER COLUMN "fileContent" SET NOT NULL;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ContractTemplate' AND column_name = 'content'
    ) THEN
      ALTER TABLE "ContractTemplate" DROP COLUMN "content";
    END IF;
  END IF;
END $$;

-- After running this, from project root run:
--   npx prisma migrate resolve --applied "20260213150000_docx_templates"
