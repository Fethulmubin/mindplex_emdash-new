import type { PluginDescriptor } from "emdash";

export function postsPlugin(): PluginDescriptor {
  return {
    id: "mindplex-posts",
    version: "1.0.0",
    format: "standard",
    entrypoint: "./plugins/src/routes/posts/sandbox-entry.ts",
    options: {},
    capabilities: ["content:read", "content:write"],
  };
}
