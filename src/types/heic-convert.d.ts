// heic-convert saknar egna typer. Bara den lilla yta vi anvander deklareras.
declare module "heic-convert" {
  interface HeicConvertOptions {
    buffer: ArrayBufferLike | Uint8Array;
    format: "JPEG" | "PNG";
    /** 0..1, endast for JPEG. */
    quality?: number;
  }

  export default function convert(
    options: HeicConvertOptions,
  ): Promise<ArrayBuffer>;
}
