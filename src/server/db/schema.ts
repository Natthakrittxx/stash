import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Every table lives here, so stash can share a database with other apps (ADR 0002).
// Exported because drizzle-kit only sees schemas a module exports.
export const stashSchema = pgSchema("stash");

export type ItemKind = "tool" | "formula" | "place";

export const items = stashSchema.table(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ItemKind>().notNull(),
    title: text("title").notNull(),
    url: text("url"),
    cmd: text("cmd"),
    // Resolved og:image of the tool's page, fetched once at save. Null for a
    // formula, or a tool whose page has no share image. No CHECK: an absent
    // preview is always valid, so a stale/missing value can never 500.
    image: text("image"),
    // A place keeps its maps link in `url` (Open in Maps hands off to the
    // phone's maps app) and its pin here. No pin means the link carried no
    // coordinates: the place still saves and lists as "Not on the map".
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    address: text("address"),
    description: text("description").notNull().default(""),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Every read is `where user_id = $1` and filtered in the browser, so `kind`
    // in the index would serve a WHERE clause that does not exist.
    index("items_user_id_idx").on(t.userId),
    // The kind/url/cmd invariant lives here, not only in Zod: a migration, a
    // script, or a Studio edit can all reach the table without passing a form.
    check(
      "items_kind_shape",
      sql`(${t.kind} = 'tool' AND ${t.url} IS NOT NULL AND ${t.cmd} IS NULL)
       OR (${t.kind} = 'formula' AND ${t.cmd} IS NOT NULL AND ${t.url} IS NULL)
       OR (${t.kind} = 'place' AND ${t.url} IS NOT NULL AND ${t.cmd} IS NULL)`,
    ),
    // Half a coordinate is no pin at all, and only a place has one.
    check(
      "items_place_pin",
      sql`(${t.lat} IS NULL AND ${t.lng} IS NULL)
       OR (${t.kind} = 'place' AND ${t.lat} IS NOT NULL AND ${t.lng} IS NOT NULL)`,
    ),
  ],
);

// A named group of items of any kind: tools, formulae and places alike.
export const collections = stashSchema.table(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("collections_user_id_idx").on(t.userId)],
);

// Many-to-many: one café can sit in "Tokyo, March" and "Coffee worth the trip".
// Nothing here stops a row joining any collection to any item, so the actions
// check that the caller is in the collection and, to file an item, saved it.
// A shared collection holds items of several accounts (ADR 0003).
export const collectionItems = stashSchema.table(
  "collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.itemId] })],
);

// The accounts a collection's Creator (its `user_id`) has shared it with. A
// collection with a row here is a shared collection.
export const collaborators = stashSchema.table(
  "collaborators",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.userId] }),
    index("collaborators_user_id_idx").on(t.userId),
  ],
);

export const user = stashSchema.table(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified")
      .$defaultFn(() => false)
      .notNull(),
    image: text("image"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    isOwner: boolean("is_owner").notNull().default(false),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
  },
  (t) => [uniqueIndex("user_one_owner").on(t.isOwner).where(sql`is_owner`)],
);

// Unused codes only: redeeming or revoking one deletes its row, so a row
// existing is what makes a code valid.
export const inviteCodes = stashSchema.table("invite_code", {
  code: text("code").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = stashSchema.table("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = stashSchema.table("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = stashSchema.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

// Secret and backup codes are encrypted with BETTER_AUTH_SECRET.
export const twoFactor = stashSchema.table(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (t) => [index("two_factor_user_id_idx").on(t.userId)],
);

// One row per account that has triggered a server fetch. Counted separately from
// items because a delete removes the item, not the fetch it caused. Spent through
// the spend_fetch function in migration 0001, which db:push doesn't create, so
// build a database with bootstrap, which also moves pre-0.3.0 instances.
export const fetchBudget = stashSchema.table("fetch_budget", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  used: integer("used").notNull(),
});

export const passkey = stashSchema.table(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (t) => [
    index("passkey_user_id_idx").on(t.userId),
    index("passkey_credential_id_idx").on(t.credentialID),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
  items: many(items),
  collections: many(collections),
}));

export const itemRelations = relations(items, ({ one, many }) => ({
  user: one(user, { fields: [items.userId], references: [user.id] }),
  collections: many(collectionItems),
}));

export const collectionRelations = relations(collections, ({ one, many }) => ({
  user: one(user, { fields: [collections.userId], references: [user.id] }),
  items: many(collectionItems),
}));

export const collectionItemRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
  item: one(items, { fields: [collectionItems.itemId], references: [items.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
