import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const templatePath = join(process.cwd(), "prisma", "contract-prestari-servicii.html");
const contractPrestariServiciiHtml = readFileSync(templatePath, "utf-8");

async function main() {
  await prisma.contractTemplate.upsert({
    where: { id: "contract-prestari-servicii" },
    create: {
      id: "contract-prestari-servicii",
      name: "Contract de prestări servicii",
      content: contractPrestariServiciiHtml,
      version: 1,
    },
    update: {
      name: "Contract de prestări servicii",
      content: contractPrestariServiciiHtml,
      version: 1,
    },
  });
  console.log("Seeded ContractTemplate: Contract de prestări servicii");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
