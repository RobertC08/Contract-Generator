const MAX_METADATA_KEYS = 40;
const MAX_KEY_LEN = 64;
const MAX_VALUE_LEN = 4096;
const MAX_WEBHOOK_URL_LEN = 2048;

export type ShareableDraftValidation =
  | { ok: true; metadata: Record<string, string>; webhookUrl: string | undefined }
  | { ok: false; message: string };

export function validateShareableDraftInput(raw: {
  metadata?: unknown;
  webhookUrl?: unknown;
}): ShareableDraftValidation {
  let webhookUrl: string | undefined;
  if (raw.webhookUrl !== undefined && raw.webhookUrl !== null) {
    if (typeof raw.webhookUrl !== "string") {
      return { ok: false, message: "webhookUrl must be a string" };
    }
    const u = raw.webhookUrl.trim();
    if (u.length === 0) {
      webhookUrl = undefined;
    } else {
      if (u.length > MAX_WEBHOOK_URL_LEN) {
        return { ok: false, message: "webhookUrl too long" };
      }
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== "https:") {
          return { ok: false, message: "webhookUrl must use https" };
        }
      } catch {
        return { ok: false, message: "webhookUrl is not a valid URL" };
      }
      webhookUrl = u;
    }
  }

  if (raw.metadata === undefined || raw.metadata === null) {
    return { ok: true, metadata: {}, webhookUrl };
  }
  if (typeof raw.metadata !== "object" || Array.isArray(raw.metadata)) {
    return { ok: false, message: "metadata must be a flat object with string values" };
  }
  const entries = Object.entries(raw.metadata as Record<string, unknown>);
  if (entries.length > MAX_METADATA_KEYS) {
    return { ok: false, message: `metadata must have at most ${MAX_METADATA_KEYS} keys` };
  }
  const metadata: Record<string, string> = {};
  for (const [k, val] of entries) {
    if (typeof k !== "string" || k.length > MAX_KEY_LEN) {
      return { ok: false, message: "metadata key invalid or too long" };
    }
    if (val === null || val === undefined) {
      metadata[k] = "";
      continue;
    }
    if (typeof val !== "string" && typeof val !== "number" && typeof val !== "boolean") {
      return { ok: false, message: `metadata values must be string, number, or boolean (key: ${k})` };
    }
    const s = String(val);
    if (s.length > MAX_VALUE_LEN) {
      return { ok: false, message: `metadata value too long for key: ${k}` };
    }
    metadata[k] = s;
  }
  return { ok: true, metadata, webhookUrl };
}
