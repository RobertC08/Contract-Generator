"use node";

import { createHash } from "crypto";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import ImageModule from "docxtemplater-image-module-free";
import { extractVariableNamesFromText } from "./extractVariableNames";
import { concatenateOoxmlWTextRuns } from "./ooxmlWText";
import { mergeDerivedContractVariables } from "../../lib/contracts/derived-contract-variables";
import { mergeCoalesceCompositePlaceholders } from "../../lib/contracts/template-coalesce";
import { mergeDefaultContractDataField } from "../../lib/contracts/contract-data-defaults";

export type VariableDefinitions = Array<{ name: string; type: string }>;

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRenderError";
  }
}

const DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|gif);base64,/i;

function parseDataUrlToBuffer(tagValue: unknown): Buffer | null {
  if (typeof tagValue !== "string" || !DATA_URL_REGEX.test(tagValue)) return null;
  const base64 = tagValue.replace(DATA_URL_REGEX, "").trim();
  return Buffer.from(base64, "base64");
}

const EMPTY_PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const IMAGE_OPTS = {
  fileType: "docx" as const,
  getImage(tagValue: unknown, _tagName: string): Buffer {
    const buf = parseDataUrlToBuffer(tagValue);
    if (buf && buf.length > 0) return buf;
    return EMPTY_PNG_1X1;
  },
  getSize(img: Buffer, _tagValue: unknown, _tagName: string): [number, number] {
    if (!img || img.length === 0 || img.equals(EMPTY_PNG_1X1)) return [1, 1];
    const SIGNATURE_WIDTH_CM = 2;
    const SIGNATURE_HEIGHT_CM = 1;
    const CM_TO_PX = 96 / 2.54;
    return [
      Math.round(SIGNATURE_WIDTH_CM * CM_TO_PX),
      Math.round(SIGNATURE_HEIGHT_CM * CM_TO_PX),
    ];
  },
};

const WORD_XML_REGEX = /^word\/(document|header\d*|footer\d*)\.xml$/;
const DROPDOWN_PLACEHOLDER_REGEX = /\{#([^{}#]+)#\s*([^}]*)\}/g;
const SIBLING_PLACEHOLDER_REGEX = /\{@([^{}]+)\}/g;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type DocxtemplaterErrorProps = {
  id?: string;
  xtag?: string;
  context?: string;
  explanation?: string;
  offset?: number;
  file?: string;
};

type DocxtemplaterError = Error & { properties?: DocxtemplaterErrorProps & { errors?: Array<{ properties?: DocxtemplaterErrorProps }> } };

function getPropsFromSub(sub: unknown): DocxtemplaterErrorProps | null {
  if (!sub || typeof sub !== "object") return null;
  const o = sub as Record<string, unknown>;
  const fromNested = o.properties ?? (sub instanceof Error && "properties" in sub ? (sub as Error & { properties?: Record<string, unknown> }).properties : undefined);
  if (fromNested && typeof fromNested === "object" && !Array.isArray(fromNested)) {
    const p = fromNested as Record<string, unknown>;
    if (p.id != null || p.xtag != null || p.explanation != null || p.context != null) {
      return { id: p.id as string | undefined, xtag: p.xtag as string | undefined, context: p.context as string | undefined, explanation: p.explanation as string | undefined, offset: p.offset as number | undefined, file: p.file as string | undefined };
    }
  }
  if (o.id != null || o.xtag != null || o.explanation != null || o.context != null) {
    return { id: o.id as string | undefined, xtag: o.xtag as string | undefined, context: o.context as string | undefined, explanation: o.explanation as string | undefined, offset: o.offset as number | undefined, file: o.file as string | undefined };
  }
  return null;
}

function readAllProps(obj: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!obj || typeof obj !== "object") return out;
  const o = obj as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(o)) {
    try {
      out[key] = o[key];
    } catch {
      // skip
    }
  }
  return out;
}

function toFriendlyMessage(e: unknown): string {
  const err = e as DocxtemplaterError;
  const propsList: DocxtemplaterErrorProps[] = [];
  const rootProps = err.properties ?? (Object.getOwnPropertyNames(err).includes("properties") ? (err as unknown as Record<string, unknown>).properties as Record<string, unknown> | undefined : undefined);
  let subErrors: unknown[] | undefined;
  if (rootProps) {
    if ("errors" in rootProps && Array.isArray((rootProps as { errors?: unknown[] }).errors)) {
      subErrors = (rootProps as { errors: unknown[] }).errors;
    } else if ("error" in rootProps && Array.isArray((rootProps as { error?: unknown[] }).error)) {
      subErrors = (rootProps as { error: unknown[] }).error;
    }
  }
  const errRecord = err as unknown as Record<string, unknown>;
  if (!subErrors && typeof errRecord.error === "object" && Array.isArray(errRecord.error)) {
    subErrors = errRecord.error as unknown[];
  }
  if (Array.isArray(subErrors)) {
    for (const sub of subErrors) {
      let p = getPropsFromSub(sub);
      if (!p) {
        const flat = readAllProps(sub);
        const fromProps = flat.properties as Record<string, unknown> | undefined;
        p = getPropsFromSub(fromProps ?? flat);
      }
      if (p) propsList.push(p);
    }
  }
  if (propsList.length === 0 && rootProps) {
    const rest = { ...rootProps };
    delete (rest as Record<string, unknown>).errors;
    const p = getPropsFromSub(rest);
    if (p) propsList.push(p);
  }
  if (propsList.length === 0) {
    return `Eroare template DOCX: ${err.message ?? "Unknown error"}`;
  }
  const explanations = propsList.map((p) => p.explanation).filter((s): s is string => s != null && s.length > 0);
  if (explanations.length === 0) {
    return `Eroare template DOCX: ${err.message ?? "Unknown error"}`;
  }
  return explanations.length === 1 ? explanations[0]! : explanations.map((e, i) => `${i + 1}. ${e}`).join("\n");
}

export type DropdownSiblingMeta = {
  dropdownOptions: Record<string, string[]>;
  dropdownSiblings: Record<string, string[]>;
};

export function extractDropdownsAndSiblingsFromDocx(templateBuffer: Buffer): DropdownSiblingMeta {
  const zip = new PizZip(templateBuffer);
  let fullText = "";
  for (const fileName of Object.keys(zip.files)) {
    if (!WORD_XML_REGEX.test(fileName)) continue;
    const file = zip.files[fileName];
    if (!file || file.dir) continue;
    try {
      fullText += concatenateOoxmlWTextRuns(file.asText());
    } catch {
      // skip
    }
  }
  const dropdownOptions: Record<string, string[]> = {};
  const dropdownSiblings: Record<string, string[]> = {};
  let lastDropdown: string | null = null;
  let match: RegExpExecArray | null;
  const dropRegex = new RegExp(DROPDOWN_PLACEHOLDER_REGEX.source, "g");
  while ((match = dropRegex.exec(fullText)) !== null) {
    const name = match[1]!;
    const label = match[2]!.trim();
    if (!dropdownOptions[name]) dropdownOptions[name] = [];
    dropdownOptions[name].push(label);
    lastDropdown = name;
  }
  const sibRegex = new RegExp(SIBLING_PLACEHOLDER_REGEX.source, "g");
  while ((match = sibRegex.exec(fullText)) !== null) {
    const varName = match[1]!;
    if (lastDropdown) {
      if (!dropdownSiblings[lastDropdown]) dropdownSiblings[lastDropdown] = [];
      dropdownSiblings[lastDropdown].push(varName);
    }
  }
  return { dropdownOptions, dropdownSiblings };
}

function preprocessDropdownAndSiblingInZip(zip: PizZip, variables: Record<string, unknown>, meta: DropdownSiblingMeta): void {
  const { dropdownOptions, dropdownSiblings } = meta;
  const siblingToDropdown: Record<string, string> = {};
  for (const [dropdown, siblings] of Object.entries(dropdownSiblings)) {
    for (const s of siblings) siblingToDropdown[s] = dropdown;
  }
  for (const fileName of Object.keys(zip.files)) {
    if (!WORD_XML_REGEX.test(fileName)) continue;
    const file = zip.files[fileName];
    if (!file || file.dir) continue;
    let content: string;
    try {
      content = file.asText();
    } catch {
      continue;
    }
    const dropdownOccurrence: Record<string, number> = {};
    content = content.replace(DROPDOWN_PLACEHOLDER_REGEX, () => "");
    content = content.replace(SIBLING_PLACEHOLDER_REGEX, (_, varName: string) => {
      const dropdown = siblingToDropdown[varName];
      if (!dropdown) return "";
      const occ = dropdownOccurrence[dropdown] ?? 0;
      dropdownOccurrence[dropdown] = occ + 1;
      const options = dropdownOptions[dropdown] ?? [];
      const selectedVal = String(variables[dropdown] ?? "").trim();
      const selectedIndex = options.indexOf(selectedVal);
      return selectedIndex === occ ? escapeXml(varName) : "";
    });
    zip.file(fileName, content);
  }
}

function ensureSignatureTagsAsImagePlaceholders(zip: PizZip, signatureVarNames: string[]): void {
  if (signatureVarNames.length === 0) return;
  for (const fileName of Object.keys(zip.files)) {
    if (!WORD_XML_REGEX.test(fileName)) continue;
    const file = zip.files[fileName];
    if (!file || file.dir) continue;
    let content: string;
    try {
      content = file.asText();
    } catch {
      continue;
    }
    for (const name of signatureVarNames) {
      content = content.split(`{${name}}`).join(`{%${name}}`);
    }
    zip.file(fileName, content);
  }
}

export function renderDocx(
  templateBuffer: Buffer,
  data: Record<string, unknown>,
  variableDefinitions?: VariableDefinitions | null
): Buffer {
  const UNDEFINED_PLACEHOLDER = "......";
  const sanitized = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === undefined || v === null ? UNDEFINED_PLACEHOLDER : v])
  ) as Record<string, unknown>;
  const withDerived = mergeDerivedContractVariables(sanitized);
  const placeholderNames = extractVariableNamesFromDocx(templateBuffer);
  const withCoalesce = mergeCoalesceCompositePlaceholders(withDerived, placeholderNames);
  const withTodayData = mergeDefaultContractDataField(withCoalesce);
  const meta = extractDropdownsAndSiblingsFromDocx(templateBuffer);
  const hasDropdowns = Object.keys(meta.dropdownOptions).length > 0;
  const zip = new PizZip(templateBuffer);
  if (hasDropdowns) {
    preprocessDropdownAndSiblingInZip(zip, withTodayData as Record<string, string>, meta);
  }
  const defs = Array.isArray(variableDefinitions) ? variableDefinitions : [];
  const signatureVarNames = defs.filter((d) => d.type === "signature").map((d) => d.name);
  ensureSignatureTagsAsImagePlaceholders(zip, signatureVarNames);
  const imageModule = new ImageModule(IMAGE_OPTS);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
    nullGetter: () => UNDEFINED_PLACEHOLDER,
  });
  try {
    doc.render(withTodayData);
  } catch (e) {
    throw new TemplateRenderError(toFriendlyMessage(e));
  }
  return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));
}

export function computeDocumentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function extractVariableNamesFromDocx(templateBuffer: Buffer): string[] {
  const zip = new PizZip(templateBuffer);
  let fullText = "";
  for (const fileName of Object.keys(zip.files)) {
    if (!WORD_XML_REGEX.test(fileName)) continue;
    const file = zip.files[fileName];
    if (!file || file.dir) continue;
    try {
      fullText += concatenateOoxmlWTextRuns(file.asText());
    } catch {
      // skip
    }
  }
  return extractVariableNamesFromText(fullText);
}
