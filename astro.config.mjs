import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import emdash from "emdash/astro";
import { postgres } from "emdash/db";
import "dotenv/config";
import { authPlugin, postsPlugin, usersPlugin } from "./plugins/src/index.ts";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    react(),
    emdash({
      database: postgres({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_USE_SSL === "true",
      }),
      plugins: [authPlugin(), postsPlugin(), usersPlugin()],
    }),
  ],
  devToolbar: { enabled: false },
});
