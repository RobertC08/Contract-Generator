import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { writeFileSync } from "fs";
import { join } from "path";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
const privateKeyValue = privateKey.trimEnd().replace(/\n/g, " ");

const envContent = `JWT_PRIVATE_KEY="${privateKeyValue}"
JWKS=${jwks}
`;
const envPath = join(process.cwd(), ".env.convex-auth");
writeFileSync(envPath, envContent);
console.log("Chei salvate în .env.convex-auth");
