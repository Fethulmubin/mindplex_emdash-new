import type { PluginDescriptor } from "emdash";

export function postsPlugin(): PluginDescriptor {
  return {
    id: "mindplex-posts",
    version: "1.0.0",
    format: "standard",
    entrypoint: "@mindplex/plugins/posts/sandbox",
    options: {},
    capabilities: ["content:read", "content:write"],
  };
}
