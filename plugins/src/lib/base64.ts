import { Buffer } from "node:buffer";

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
