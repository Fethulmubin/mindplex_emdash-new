import { Buffer } from "node:buffer";
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import {
  ActivateSchema,
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  SocialSchema,
} from "./schemas";
import { activate, login, logout, refresh, register, social } from "./routes";

export default definePlugin({
  hooks: {
    "plugin:install": {
      handler: async (_event: any, ctx: PluginContext) => {
        const existing = await ctx.kv.get("settings:jwtSecret");
        if (!existing) {
          const secret = crypto.getRandomValues(new Uint8Array(48));
          const jwtSecret = Buffer.from(secret).toString("base64");
          await ctx.kv.set("settings:jwtSecret", jwtSecret);
          ctx.log.info("mindplex-auth: generated JWT secret");
        }
      },
    },
  },
  routes: {
    login: {
      public: true,
      input: LoginSchema,
      handler: login,
    },
    register: {
      public: true,
      input: RegisterSchema,
      handler: register,
    },
    activate: {
      public: true,
      input: ActivateSchema,
      handler: activate,
    },
    social: {
      public: true,
      input: SocialSchema,
      handler: social,
    },
    refresh: {
      public: true,
      input: RefreshSchema,
      handler: refresh,
    },
    logout: {
      public: true,
      handler: logout,
    },
  },
});
