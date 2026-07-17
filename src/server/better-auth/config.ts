import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "~/env";
import { db } from "~/server/db";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // Trusting Google waives verification on the *incoming* identity only. It
      // says nothing about the local account being linked onto, so it is not
      // what makes this safe. What blocks the pre-registration takeover — an
      // attacker signs up victim@gmail.com with a password, the victim later
      // arrives via Google, the accounts link, and the attacker's password now
      // opens their stash — is better-auth's requireLocalEmailVerified, which
      // defaults to true and refuses to link onto an unverified local account.
      // Leave it alone: nothing here sends a verification email, so a password
      // account is never emailVerified, and setting it false would hand over
      // every account whose email someone can guess.
      trustedProviders: ["google"],
    },
  },
});

export type Session = typeof auth.$Infer.Session;
