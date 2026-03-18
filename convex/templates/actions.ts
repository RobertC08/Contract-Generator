"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { extractVariableNamesFromDocx, extractDropdownsAndSiblingsFromDocx } from "../lib/docxGenerator.node";
import mammoth from "mammoth";

export const extractVariablesFromFile = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ variableNames: string[] }> => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("File not found");
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    const variableNames = extractVariableNamesFromDocx(buffer);
    return { variableNames };
  },
});

export const getTemplateContentHtml = action({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args): Promise<{
    content?: string;
    variableDefinitions?: unknown;
    variableNamesFromDocx?: string[];
    dropdownOptionsList?: Array<{ name: string; options: string[] }>;
    dropdownSiblingsList?: Array<{ dropdown: string; siblings: string[] }>;
  }> => {
    const template = await ctx.runQuery(internal.contracts.getTemplateFile, { templateId: args.templateId });
    if (!template) throw new Error("Template not found");
    const url = await ctx.storage.getUrl(template.fileStorageId);
    if (!url) return { variableDefinitions: template.variableDefinitions };
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    const variableNamesFromDocx = extractVariableNamesFromDocx(buffer);
    const dropdownMeta = extractDropdownsAndSiblingsFromDocx(buffer);
    const dropdownOptionsList =
      Object.keys(dropdownMeta.dropdownOptions).length > 0
        ? Object.entries(dropdownMeta.dropdownOptions).map(([name, options]) => ({ name, options }))
        : undefined;
    const dropdownSiblingsList =
      Object.keys(dropdownMeta.dropdownSiblings).length > 0
        ? Object.entries(dropdownMeta.dropdownSiblings).map(([dropdown, siblings]) => ({ dropdown, siblings }))
        : undefined;
    try {
      const result = await mammoth.convertToHtml({ buffer });
      const content = result.value?.trim() ? result.value : undefined;
      return {
        content,
        variableDefinitions: template.variableDefinitions,
        variableNamesFromDocx: variableNamesFromDocx.length > 0 ? variableNamesFromDocx : undefined,
        dropdownOptionsList,
        dropdownSiblingsList,
      };
    } catch {
      return {
        variableDefinitions: template.variableDefinitions,
        variableNamesFromDocx: variableNamesFromDocx.length > 0 ? variableNamesFromDocx : undefined,
        dropdownOptionsList,
        dropdownSiblingsList,
      };
    }
  },
});

export const extractVariablesFromTemplate = action({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args): Promise<{ variableNames: string[] }> => {
    const template = await ctx.runQuery(internal.contracts.getTemplateFile, { templateId: args.templateId });
    if (!template) throw new Error("Template not found");
    const url = await ctx.storage.getUrl(template.fileStorageId);
    if (!url) return { variableNames: [] };
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    const variableNames = extractVariableNamesFromDocx(buffer);
    return { variableNames };
  },
});
