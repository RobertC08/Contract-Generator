declare module "docxtemplater-image-module-free" {
  import type { Docxtemplater } from "docxtemplater";
  interface ImageModuleOptions {
    fileType: "docx";
    getImage: (tagValue: unknown, tagName: string) => Buffer;
    getSize: (img: Buffer, tagValue: unknown, tagName: string) => [number, number];
  }
  class ImageModule {
    constructor(options: ImageModuleOptions);
  }
  export default ImageModule;
}
