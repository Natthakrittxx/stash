import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { env } from "~/env";
import { INVITE_COOKIE } from "~/invite";
import { db } from "~/server/db";
import { inviteCodes } from "~/server/db/schema";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  // ponytail: no email provider, so password accounts are never verified. An
  // invited person can register an address they don't own; the real owner then
  // can't sign up with a password, and Google won't link onto it (see below).
  // Invite codes keep this to people the Owner chose. Add a mailer and
  // requireEmailVerification if instances ever admit strangers.
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      // input: false, so no signup or profile request can set it.
      isOwner: { type: "boolean", input: false, defaultValue: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The one admission check: password and Google signup both create a
        // user through here. better-auth rejects an email already in use before
        // calling this, so that failure can't use up a code. The delete is the
        // atomic step: of two people submitting one code, only one gets the row.
        before: async (newUser, ctx) => {
          const code = ctx?.getCookie(INVITE_COOKIE);
          const [invite] = code
            ? await db
                .delete(inviteCodes)
                .where(eq(inviteCodes.code, code))
                .returning({ isSetup: inviteCodes.isSetup })
            : [];
          if (!invite) {
            // Google's callback turns the message into `?error=invite_required`.
            throw new APIError("FORBIDDEN", {
              code: "INVITE_REQUIRED",
              message: "invite_required",
            });
          }
          return { data: { ...newUser, isOwner: invite.isSetup } };
        },
      },
    },
  },
  // Every page load and server action reads the session. A short signed cookie
  // cache answers that without a DB round trip; a revoked session can outlive
  // its revocation by up to this maxAge. Sign out clears the cookie at once.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
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
