const VAR_PLACEHOLDER = "\u0000VAR\u0000";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sourceToHtml(source: string): string {
  const protectedVars: string[] = [];
  let text = source.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    protectedVars.push(`{{${name}}}`);
    return VAR_PLACEHOLDER;
  });
  text = escapeHtml(text);
  protectedVars.forEach((v) => {
    text = text.replace(VAR_PLACEHOLDER, v);
  });
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim().replace(/\n/g, "<br/>"))
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("\n");
  const body = paragraphs || "<p></p>";
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Contract</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; padding: 15mm; color: #222; }
    .underline { border-bottom: 1px solid #222; display: inline-block; min-width: 80px; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

export function htmlToSource(html: string): string {
  const bodyMatch = html.replace(/\s+/g, " ").match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const inner = bodyMatch ? bodyMatch[1] : html;
  const text = inner
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

export function isHtmlContent(content: string): boolean {
  return content.trimStart().startsWith("<");
}

const DOCUMENT_SHELL = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Contract</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; padding: 15mm; color: #222; }
    .underline { border-bottom: 1px solid #222; display: inline-block; min-width: 80px; }
  </style>
</head>
<body>
`;

export function wrapFragmentInDocument(fragment: string): string {
  const trimmed = fragment.trim();
  if (trimmed.toLowerCase().includes("<html")) return trimmed;
  return DOCUMENT_SHELL + trimmed + "\n</body>\n</html>";
}
