export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRenderError";
    Object.setPrototypeOf(this, TemplateRenderError.prototype);
  }
}

export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Template not found: ${templateId}`);
    this.name = "TemplateNotFoundError";
    Object.setPrototypeOf(this, TemplateNotFoundError.prototype);
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class ContractSignedError extends Error {
  constructor(message: string = "Contract is signed and cannot be modified") {
    super(message);
    this.name = "ContractSignedError";
    Object.setPrototypeOf(this, ContractSignedError.prototype);
  }
}
