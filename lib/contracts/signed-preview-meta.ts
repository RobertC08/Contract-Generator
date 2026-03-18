export type SignedPreviewMeta = {
  contractNumbers: Array<{ name: string; label: string; value: string }>;
  signatures: Array<{ name: string; label: string; dataUrl: string }>;
};

export function buildSignedDocumentPreviewMeta(
  variablesList: Array<{ key: string; value: string }>,
  defs: Array<{ name?: string; type?: string; label?: unknown }>
): SignedPreviewMeta {
  const vars: Record<string, string> = Object.fromEntries(
    variablesList.map((p) => [p.key, p.value])
  );
  const contractNumbers: SignedPreviewMeta["contractNumbers"] = [];
  const signatures: SignedPreviewMeta["signatures"] = [];
  for (const d of defs) {
    const name = d.name;
    if (!name || typeof name !== "string") continue;
    if (d.type === "contractNumber") {
      contractNumbers.push({
        name,
        label: typeof d.label === "string" && d.label ? d.label : name,
        value: vars[name] ?? "—",
      });
    }
    if (d.type === "signature") {
      const val = vars[name];
      if (typeof val === "string" && /^data:image\//i.test(val)) {
        signatures.push({
          name,
          label: typeof d.label === "string" && d.label ? d.label : name,
          dataUrl: val,
        });
      }
    }
  }
  return { contractNumbers, signatures };
}
