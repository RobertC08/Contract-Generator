import fs from "fs";
import path from "path";

export interface StorageProvider {
  save(key: string, buffer: Buffer): Promise<string>;
}

const LOCAL_CONTRACTS_DIR = "public/contracts";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string = LOCAL_CONTRACTS_DIR) {
    this.baseDir = path.isAbsolute(baseDir)
      ? baseDir
      : path.join(process.cwd(), baseDir);
  }

  async save(key: string, buffer: Buffer): Promise<string> {
    ensureDir(this.baseDir);
    const safeKey = path.basename(key).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(this.baseDir, `${safeKey}.pdf`);
    fs.writeFileSync(filePath, buffer);
    return `/contracts/${safeKey}.pdf`;
  }
}
