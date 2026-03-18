/** Keep in sync with lib/contracts/ooxml-w-text.ts */

const W_T_REGEX = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;

function decodeWTextInner(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function concatenateOoxmlWTextRuns(xml: string): string {
  const parts: string[] = [];
  const re = new RegExp(W_T_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    parts.push(decodeWTextInner(m[1] ?? ""));
  }
  return parts.join("");
}
