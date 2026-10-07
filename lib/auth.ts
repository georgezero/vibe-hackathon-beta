import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { isProductionSafeRuntime } from "@/lib/runtime-mode";
import { vibyAuthenticationPlugin } from "@/lib/auth/viby-authentication-plugin";
import { getAccountControlState } from "@/lib/account-controls";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.VIBE_HACKATHON_BASE_URL ?? getBaseUrl(),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  databaseHooks: {
    session: {
      create: {
        async before(session) {
          const control = await getAccountControlState(session.userId);
          return control.status === "valid"
            && control.control.status === "active";
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  rateLimit: {
    enabled: isProductionSafeRuntime(),
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  plugins: [vibyAuthenticationPlugin(), nextCookies()],
});
