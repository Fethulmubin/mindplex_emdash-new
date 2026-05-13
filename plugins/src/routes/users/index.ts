// plugins/src/routes/users/index.ts
import type { PluginDescriptor } from "emdash";

export function usersPlugin(): PluginDescriptor {
  return {
    id: "mindplex-users",
    version: "1.0.0",
    format: "standard",              
    entrypoint: "@mindplex/plugins/users/sandbox",
    options: {},
    capabilities: [],                // direct DB — no content API caps needed
    storage: {},
    adminPages: [
      { path: "/users", label: "Users", icon: "users" },
    ],
  };
}