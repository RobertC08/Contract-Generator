-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED');
CREATE TYPE "SignerRole" AS ENUM ('teacher', 'student', 'guardian');
CREATE TYPE "AuthMethod" AS ENUM ('otp', 'magic_link');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "documentHash" TEXT,
ADD COLUMN "templateVersion" INTEGER;

-- CreateTable
CREATE TABLE "Signer" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "SignerRole" NOT NULL DEFAULT 'student',
    "signingOrder" INTEGER NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMP(3),
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningOtp" (
    "id" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "hashedCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "SigningOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureAuditLog" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "authMethod" "AuthMethod" NOT NULL,
    "documentHash" TEXT,
    "contractVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Signer_token_key" ON "Signer"("token");

-- AddForeignKey
ALTER TABLE "Signer" ADD CONSTRAINT "Signer_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningOtp" ADD CONSTRAINT "SigningOtp_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAuditLog" ADD CONSTRAINT "SignatureAuditLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAuditLog" ADD CONSTRAINT "SignatureAuditLog_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
