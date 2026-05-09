import { toBase64 } from "./base64";

export const generateActivationToken = () =>
  toBase64(crypto.getRandomValues(new Uint8Array(32)));
