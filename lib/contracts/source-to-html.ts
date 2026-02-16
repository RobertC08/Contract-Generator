const VAR_PLACEHOLDER = "\u0000VAR\u0000";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts plain text to an HTML fragment (paragraphs only). Used e.g. when
 * converting plain text to HTML fragments (e.g. page breaks between fragments).
 */
export function textToParagraphsFragment(source: string): string {
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
  return paragraphs || "<p></p>";
}

export function sourceToHtml(source: string): string {
  const body = textToParagraphsFragment(source);
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Contract</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body, body * { overflow-wrap: break-word; word-break: break-word; box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; padding: 15mm; color: #222; width: 100%; max-width: 210mm; }
    p { margin: 2mm 0; }
    h1 { font-size: 14pt; text-align: center; margin: 4mm 0; }
    h2 { font-size: 12pt; margin: 4mm 0 2mm; }
    .underline { border-bottom: 1px solid #222; display: inline-block; min-width: 80px; }
    .page-break { page-break-after: always; }
    .signature-img { max-width: 200px; max-height: 100px; width: auto; height: auto; display: inline-block; vertical-align: middle; }
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

export const DOCUMENT_SHELL = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Contract</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body, body * { overflow-wrap: break-word; word-break: break-word; box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; padding: 15mm; color: #222; width: 100%; max-width: 210mm; }
    p { margin: 2mm 0; }
    h1 { font-size: 14pt; text-align: center; margin: 4mm 0; }
    h2 { font-size: 12pt; margin: 4mm 0 2mm; }
    .underline { border-bottom: 1px solid #222; display: inline-block; min-width: 80px; }
    .page-break { page-break-after: always; }
    .signature-img { max-width: 200px; max-height: 100px; width: auto; height: auto; display: inline-block; vertical-align: middle; }
  </style>
</head>
<body>
`;

const LAYOUT_STYLES =
  "body, body * { overflow-wrap: break-word; word-break: break-word; } body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; padding: 15mm; color: #222; width: 100%; max-width: 210mm; } p { margin: 2mm 0; } h1 { font-size: 14pt; text-align: center; margin: 4mm 0; } h2 { font-size: 12pt; margin: 4mm 0 2mm; } .underline { border-bottom: 1px solid #222; display: inline-block; min-width: 80px; } .signature-img { max-width: 200px; max-height: 100px; width: auto; height: auto; }";

export function ensureLayoutStyles(html: string): string {
  const hasSignatureImg = /\.signature-img\s*\{/.test(html);
  const hasOverflowWrap = /overflow-wrap:\s*break-word/.test(html);
  const shouldSkip = hasSignatureImg && hasOverflowWrap;
  // #region agent log
  console.log('[ensureLayoutStyles]', JSON.stringify({location:'source-to-html.ts:ensureLayoutStyles',message:'Checking layout styles',data:{shouldSkip,hasSignatureImg,hasOverflowWrap,hasHead:html.includes('</head>'),hasBody:html.includes('<body'),htmlStartsWith:html.substring(0,200)},timestamp:Date.now(),hypothesisId:'H5,H6'}));
  // #endregion
  if (shouldSkip) return html;
  if (html.includes("</head>")) {
    return html.replace(
      "</head>",
      `<style>@page { size: A4; margin: 15mm; } ${LAYOUT_STYLES}</style></head>`
    );
  }
  if (html.includes("<body")) {
    return html.replace(
      "<body",
      `<head><meta charset="utf-8"><title>Contract</title><style>@page { size: A4; margin: 15mm; } ${LAYOUT_STYLES}</style></head><body`
    );
  }
  return html;
}

export function wrapFragmentInDocument(fragment: string): string {
  const trimmed = fragment.trim();
  const isFullHtml = trimmed.toLowerCase().includes("<html");
  // #region agent log
  console.log('[wrapFragmentInDocument]', JSON.stringify({location:'source-to-html.ts:wrapFragment',message:'Wrapping content',data:{isFullHtml,trimmedStartsWith:trimmed.substring(0,150)},timestamp:Date.now(),hypothesisId:'H3,H5'}));
  // #endregion
  if (isFullHtml) return ensureLayoutStyles(trimmed);
  
  const inlineStyleMatch = trimmed.match(/^(<style[\s>][\s\S]*?<\/style>\s*)/i);
  if (inlineStyleMatch) {
    const inlineStyles = inlineStyleMatch[1];
    const contentAfterStyles = trimmed.substring(inlineStyles.length);
    // #region agent log
    console.log('[wrapFragmentInDocument:inlineStyles]', JSON.stringify({location:'source-to-html.ts:wrapFragment:inlineStyles',message:'Found inline styles in fragment',data:{inlineStylesLength:inlineStyles.length,contentAfterStylesStartsWith:contentAfterStyles.substring(0,100)},timestamp:Date.now(),hypothesisId:'H7'}));
    // #endregion
    return DOCUMENT_SHELL.replace('</head>', inlineStyles + '\n</head>') + contentAfterStyles + "\n</body>\n</html>";
  }
  
  return DOCUMENT_SHELL + trimmed + "\n</body>\n</html>";
}
