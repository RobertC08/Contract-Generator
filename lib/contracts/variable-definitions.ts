import { z } from "zod";

export const VARIABLE_TYPES = [
  "text",
  "number",
  "date",
  "month",
  "cui",
] as const;

export type VariableType = (typeof VARIABLE_TYPES)[number];

const linkedVariablesSchema = z.object({
  denumire: z.string().min(1),
  sediu: z.string().min(1),
  regCom: z.string().min(1),
});

export const variableDefinitionSchema = z
  .object({
    name: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, "Doar litere, cifre și _"),
    type: z.enum(VARIABLE_TYPES),
    label: z.string().optional(),
    linkedVariables: linkedVariablesSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.type !== "cui") return true;
      return (
        data.linkedVariables?.denumire &&
        data.linkedVariables?.sediu &&
        data.linkedVariables?.regCom
      );
    },
    { message: "Tipul CUI necesită variabile legate: denumire, sediu, regCom" }
  );

export type VariableDefinition = z.infer<typeof variableDefinitionSchema>;

export const variableDefinitionsSchema = z
  .array(variableDefinitionSchema)
  .refine(
    (arr) => {
      const names = arr.map((v) => v.name);
      return new Set(names).size === names.length;
    },
    { message: "Numele variabilelor trebuie să fie unice" }
  );

export type VariableDefinitions = z.infer<typeof variableDefinitionsSchema>;

export function validateVariableDefinitions(
  value: unknown
): { success: true; data: VariableDefinitions } | { success: false; message: string } {
  const result = variableDefinitionsSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  const first = result.error.issues[0];
  return {
    success: false,
    message: first?.message ?? "Definiții variabile invalide",
  };
}
