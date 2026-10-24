import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { after } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  // A password account can't log in until its email is verified. Without this,
  // anyone could register someone else's address and wait for them to arrive.
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ user, url }) =>
      sendEmail(
        user.email,
        "Verify your email for Stash",
        `Open this link to verify your email and open your stash:\n\n${url}`,
      ),
  },
  advanced: {
    // Signup answers the same whether or not the email is taken. Sending the
    // verification mail after the response keeps the timing from saying so too.
    backgroundTasks: { handler: after },
  },
  plugins: [
    // Signs in or signs up. Verifying an existing unverified account deletes
    // its password and sessions first (better-auth's
    // revokeUnprovenAccountAccess), so a squatter's password dies here.
    magicLink({
      sendMagicLink: ({ email, url }) =>
        sendEmail(
          email,
          "Your Stash login link",
          `Open this link to log in. It works once and expires in 5 minutes.\n\n${url}`,
        ),
    }),
  ],
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
      // Leave it alone: setting it false would hand over every account whose
      // owner hasn't clicked their verification email yet.
      trustedProviders: ["google"],
    },
  },
});

export type Session = typeof auth.$Infer.Session;
