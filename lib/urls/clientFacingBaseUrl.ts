export function resolveClientFacingBaseUrl(
  publicAppUrl: string | undefined | null,
  siteUrl: string | undefined | null
): string {
  const a = publicAppUrl != null ? String(publicAppUrl).trim() : "";
  const b = siteUrl != null ? String(siteUrl).trim() : "";
  return (a || b).replace(/\/$/, "");
}
