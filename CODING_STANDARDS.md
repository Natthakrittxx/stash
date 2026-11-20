# Coding standards

The judgement calls a review checks a diff against. Formatting, lint and types are enforced by `bun run check` and `bun run format:check`; visual rules live in `DESIGN.md` and the accessibility bar in `PRODUCT.md`. Each rule names code that already follows it.

## Server actions

- **Validate every argument.** An exported action zod-parses each argument before any query: ids with `idSchema`, names with their own schema. Bad input comes back as `{ error }`, because a throw surfaces as a 500. (`updateItem`, `setMembership`, `renameTag`)
- **Scope every write to the caller.** Each update and delete carries `user_id = <caller>` in its `where`, so another account's id matches nothing. A shared collection lends reads of another account's items, never writes (ADR 0003). (`deleteItem`, `deleteTag`)
- **One change, one transaction.** A write that spans tables, such as a tag row and the item arrays naming it, runs inside `db.transaction`. (`renameTag`, `dropCollaborator`)
- **Test access rules on real Postgres.** Who may read or change what is tested on PGlite with the real migrations, through the actions and `loadStash`. (`sharing.test.ts`, `tags.test.ts`)

## Interaction

- **Hand focus on.** When a control unmounts under focus (an inline form closes, a confirm resolves, a row is deleted), focus moves to the next useful action: the button that opened it, Undo, or search. (`NewCollection`, `TagActions`, the undo toast)
- **Esc cancels in place.** An inline form or confirm handles Escape itself with `preventDefault` and `stopPropagation`, so the page-level Esc handler stays out of it. (`NewCollection`, `TagActions`)
- **State shows in shape.** Selected, active, new and invalid states carry a mark, word, outline or edge alongside any colour or ground change. (filter rows' ✓, the tag picker's active outline, the dashed new-tag chip)
