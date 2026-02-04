declare module "@sparticuz/chromium-min" {
  export const args: string[];
  export const defaultViewport: { width: number; height: number } | null;
  export const headless: boolean | "shell";
  export function executablePath(): Promise<string>;
}
