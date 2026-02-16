-- Rulează acest SQL în Supabase (SQL Editor) dacă migrarea nu poate rula (ex. shadow database).
-- Adaugă coloana pentru DOCX-ul de preview la pasul 1.
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "previewPdfContent" BYTEA;
