import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import PizZip from "pizzip";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function createMinimalDocx(): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  zip.file(
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Contract prestări servicii. Variabile: {{denumire}}, {{cui}}.</w:t></w:r></w:p></w:body></w:document>'
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  );
  const out = zip.generate({ type: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

async function main() {
  const fileContent = new Uint8Array(createMinimalDocx());
  const variableDefinitions = [
    { name: "denumire", type: "text" as const, label: "Denumire firmă" },
    { name: "cui", type: "cui" as const, label: "CUI" },
  ];

  await prisma.contractTemplate.upsert({
    where: { id: "contract-prestari-servicii" },
    create: {
      id: "contract-prestari-servicii",
      name: "Contract de prestări servicii",
      fileContent: fileContent as Parameters<typeof prisma.contractTemplate.create>[0]["data"]["fileContent"],
      version: 1,
      variableDefinitions: variableDefinitions as Parameters<typeof prisma.contractTemplate.create>[0]["data"]["variableDefinitions"],
    },
    update: {
      name: "Contract de prestări servicii",
      fileContent: fileContent as Parameters<typeof prisma.contractTemplate.update>[0]["data"]["fileContent"],
      variableDefinitions: variableDefinitions as Parameters<typeof prisma.contractTemplate.update>[0]["data"]["variableDefinitions"],
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
