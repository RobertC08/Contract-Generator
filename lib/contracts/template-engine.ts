import Handlebars from "handlebars";
import { TemplateRenderError } from "./errors";

export { TemplateRenderError } from "./errors";

export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  try {
    const fn = Handlebars.compile(template);
    return fn(variables);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new TemplateRenderError(message);
  }
}
