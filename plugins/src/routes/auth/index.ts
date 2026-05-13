import type { PluginDescriptor } from "emdash";

export function authPlugin(): PluginDescriptor {
  return {
    id: "mindplex-auth",
    version: "1.0.0",
    format: "standard",
    entrypoint: "@mindplex/plugins/auth/sandbox",
    options: {},
    capabilities: ["email:send", "network:request"],
    allowedHosts: ["oauth2.googleapis.com", "www.googleapis.com"],
    storage: {},

  };
}
