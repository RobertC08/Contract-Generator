import type { FunctionReference } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type ApiActions = {
  contracts: {
    actions: {
      createContract: FunctionReference<
        "action",
        "public",
        {
          templateId: Id<"contractTemplates">;
          parentContractId?: Id<"contracts">;
          variablesList: Array<{ key: string; value: string }>;
          signers: Array<{ fullName: string; email: string; phone?: string; role?: string; signingOrder?: number }>;
        },
        { contractId: Id<"contracts">; signingLinks: unknown[] }
      >;
      createShareableDraft: FunctionReference<"action", "public", { templateId: Id<"contractTemplates">; parentContractId?: Id<"contracts"> }, { contractId: Id<"contracts">; fillLink: string }>;
      generateDocument: FunctionReference<"action", "public", { contractId: Id<"contracts"> }, { documentUrl: string }>;
      getDocumentUrl: FunctionReference<"action", "public", { contractId: Id<"contracts"> }, string | null>;
      getReadStepPreviewUrl: FunctionReference<"action", "public", { contractId: Id<"contracts"> }, string | null>;
      getAuditReportHtml: FunctionReference<"action", "public", { contractId: Id<"contracts"> }, string>;
      updateDraftAndGenerateDocument: FunctionReference<
        "action",
        "public",
        {
          contractId: Id<"contracts">;
          variablesList: Array<{ key: string; value: string }>;
          signers?: Array<{ fullName: string; email: string; phone?: string; role?: string }>;
        },
        { signingLinks: unknown[] }
      >;
      regenerateContractDocument: FunctionReference<"action", "public", { contractId: Id<"contracts"> }, void>;
    };
  };
  templates: {
    actions: {
      extractVariablesFromFile: FunctionReference<"action", "public", { storageId: Id<"_storage"> }, { variableNames: string[] }>;
      getTemplateContentHtml: FunctionReference<
        "action",
        "public",
        { templateId: Id<"contractTemplates"> },
        {
          content?: string;
          variableDefinitions?: unknown;
          variableNamesFromDocx?: string[];
          dropdownOptionsList?: Array<{ name: string; options: string[] }>;
          dropdownSiblingsList?: Array<{ dropdown: string; siblings: string[] }>;
        }
      >;
      extractVariablesFromTemplate: FunctionReference<"action", "public", { templateId: Id<"contractTemplates"> }, { variableNames: string[] }>;
    };
  };
  sign: {
    actions: {
      sendOtp: FunctionReference<"action", "public", { token: string }, { success: true; code?: string } | { success: false; message: string }>;
      verifyOtp: FunctionReference<"action", "public", { token: string; code: string }, { success: true; claim: string } | { success: false; message: string }>;
      submitSignature: FunctionReference<
        "action",
        "public",
        Record<string, unknown>,
        | { success: true; documentUrl: string; previewMeta: { contractNumbers: Array<{ name: string; label: string; value: string }>; signatures: Array<{ name: string; label: string; dataUrl: string }> } }
        | { success: false; message: string }
      >;
    };
  };
  anaf: {
    actions: {
      fetchCompanyByCui: FunctionReference<"action", "public", { cui: string; data?: string }, { cui: string; denumire: string; adresa: string; nrRegCom: string; iban?: string; telefon?: string } | null>;
    };
  };
};

const a = api as Record<string, unknown>;
export const actions = {
  contracts: { actions: a["contracts/actions"] },
  templates: { actions: a["templates/actions"] },
  sign: { actions: a["sign/actions"] },
  anaf: { actions: a["anaf/actions"] },
} as unknown as ApiActions;
