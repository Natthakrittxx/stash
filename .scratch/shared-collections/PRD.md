# Shared collections

Status: ready-for-agent

## Problem Statement

Two people on the same instance plan a trip, a reading list or a home project together, and each has saved things that belong in it. Today every collection is visible only to the account that made it, so they swap links in chat and both lose track. The only way to show someone an item is to tell them about it. Nobody wants to hand over a whole stash for this. They want a single collection that both of them can see and fill.

## Solution

Any collection can become a shared collection. Its Creator picks Collaborators from the accounts on the instance, and the collection appears in their rail straight away. Everyone in a shared collection sees what is filed in it and can file their own items there. Each item still belongs to the person who saved it (ADR 0003). Others see it only inside that collection, labelled with its saver's name. They can take it out, but they cannot edit it, delete it or file it anywhere else. Everything outside shared collections stays private, as PRODUCT.md principle 4 requires.

## User Stories

1. As a Creator, I want to add a Collaborator to one of my existing collections, so that I can share it without rebuilding it.
2. As a Creator, I want to choose Collaborators from a list of the instance's accounts showing name and email, so that I add the right person even when two people share a name.
3. As a Creator, I want the list to leave out me and anyone already in the collection, so that I can't add someone twice or add myself.
4. As a Creator, I want to remove a Collaborator, so that I decide who stays in my collection.
5. As a Creator, I want a removed Collaborator's items to leave the collection, so that nobody keeps seeing their things after they are out.
6. As a Creator, I want my collection to become private again once its last Collaborator goes, so that sharing is never a separate mode to switch off.
7. As a Creator, I want to be the only one who can delete the collection, so that a Collaborator can't remove it for everyone.
8. As a Creator, when I delete a shared collection, I want every item in it to stay in its saver's stash, so that deleting never destroys anyone's saves.
9. As a Collaborator, I want a collection I was added to to appear in my rail without accepting anything, so that I can start using it at once.
10. As a Collaborator, I want to leave a shared collection, so that I can get out of one I don't want.
11. As a Collaborator, when I leave, I want my items to leave the collection with me, so that the others no longer see them.
12. As a Collaborator, I want to file my own items into the shared collection, so that I contribute to it the same way I file into my own collections.
13. As a Collaborator, I want an item I save while the shared collection is open to be filed into it, so that saving into a shared collection works like saving into my own.
14. As anyone in a shared collection, I want to see every item filed in it, whoever saved it, so that the collection shows everything we gathered.
15. As anyone in a shared collection, I want items I didn't save to show "Saved by <name>", so that I know whose they are.
16. As anyone in a shared collection, I want no Edit or Delete on items I didn't save, so that I can't change someone else's stash.
17. As anyone in a shared collection, I want to take any item out of it, so that we can tidy the collection without asking the saver.
18. As a saver, when someone takes my item out of a shared collection, I want it to stay in my stash, so that tidying never loses anything.
19. As anyone in a shared collection, I want search, tags, kinds and the map to work inside it over everyone's items, so that finding things again works as it does in my own collections.
20. As anyone in a shared collection, I want its places from every saver on the map, so that we plan a trip on one map.
21. As anyone, I want other people's items kept out of my full list and my stash-wide search, so that my stash still holds only what I saved.
22. As anyone, I want other people's items kept out of my tag list unless a shared collection is open, so that my rail reflects my own stash.
23. As anyone, I want a shared collection marked in the rail, so that I know before filing anything that others will see it.
24. As anyone in a shared collection, I want its header to name the Creator and every Collaborator, so that I know who sees what I file there.
25. As a saver, I want to be unable to file someone else's item into any collection, so that their item only appears where they put it.
26. As a saver, I want my own private collections to stay invisible to everyone else, even to people I share another collection with, so that sharing one collection reveals nothing else.
27. As a Collaborator, I want the shared collection removed from my rail when the Creator's account is deleted, while my items stay in my stash, so that an account going away never takes my saves with it.
28. As a Creator, I want deleting a Collaborator's account to take their items out of my collection, so that a deleted account leaves nothing behind.
29. As a Collaborator, I want to be unable to add or remove other people, so that only the Creator decides who is in.
30. As a Collaborator, I want to be unable to delete the shared collection, so that only the Creator can remove it for everyone.
31. As anyone, I want an action on a collection I'm not in to fail as "No such collection.", so that nobody can probe which collections exist.
32. As anyone, I want undoing a delete to file the restored item back into every collection it was in, shared ones included, so that undo restores exactly what was there.
33. As a keyboard or screen-reader user, I want the shared marker, the people list, the account picker, Take out and Leave to be reachable and announced, so that sharing meets WCAG 2.2 AA like the rest of stash.
34. As a phone user, I want the people controls to fit narrow widths, so that I can share from my phone.

## Implementation Decisions

- **Schema:** add one table of Collaborators. Each row joins a collection to an account and records when the account was added. Its primary key is the pair. It cascades on delete of either the collection or the account, and it has an index on the account. Nothing else in the schema changes. The collection's own account column already identifies the Creator. Generate one additive migration in the `stash` schema (ADR 0002).
- **Being in a collection:** an account is in a collection when it is the collection's Creator or has a Collaborator row for it. One shared query condition expresses this, and every read and write that touches a collection uses it.
- **Loader:** pull the stash page's queries into one function that takes the signed-in account and returns everything the page renders. The page stays a thin caller, and the function is the test seam. It returns:
  - the caller's own items, each with no saver name;
  - every other account's items filed in a collection the caller is in, each carrying its saver's name and listed once even when filed in several;
  - the collections the caller is in, each with its name, filed item ids, Creator name, whether the caller is its Creator, and its Collaborators (id and name);
  - every other account on the instance (id, name, email), for the Creator's picker.
- **Item shape on the client:** gains a saver name that is empty for the caller's own items. The list is built from the caller's own items, plus other people's items when a collection is open. Search, tags, kind counts and the map all read from that list. Rail counts per collection count everyone's items, so a shared collection's count is right before it is opened.
- **Actions, changed:**
  - Filing an item in (the existing filing toggle) requires the caller to be in the collection and to have saved the item.
  - Taking an item out requires only that the caller is in the collection and the item is filed there.
  - Saving with a collection open, or undoing a delete, files the item into every requested collection the caller is in.
  - Deleting a collection stays Creator-only.
  - Item edit, delete and set-pin stay saver-only.
- **Actions, new:**
  - Add a Collaborator (Creator only). The account must exist and must not be the Creator. Adding someone already in is a no-op.
  - Remove a Collaborator (Creator only).
  - Leave a collection (Collaborator only).
  - Remove and leave both delete the Collaborator row and take that account's items out of the collection, in one transaction.
  - Every refusal returns "No such collection." and changes nothing.
- **Rail:** a shared collection shows a small marker beside its name, with an accessible label saying it is shared.
- **Collection header:** names the Creator and Collaborators. The Creator gets a People control: the account picker shows name and email and leaves out the Creator and anyone already in, and each Collaborator has a Remove. A Collaborator gets Leave, and only the Creator gets Delete.
- **Item rows, previews and cards:** an item saved by someone else shows "Saved by <name>". It has no Edit, Delete, Set location or Collections panel. It gets a single "Take out of <collection>" action instead.
- **Vocabulary:** Creator, Collaborator and Shared collection as defined in CONTEXT.md. The existing code's "membership" means an item being filed in a collection and is left as is; people are never called members.

## Testing Decisions

- A good test drives the feature the way the app does: it calls a server action or the loader as a given account, then checks what each account can see or change. It never inspects queries or internal helpers.
- **Seam:** the stash server actions plus the loader function, run under `bun test` against real Postgres. That Postgres is PGlite, in process, added as a devDependency, with the real migrations applied to a fresh in-memory database. Only the session lookup and Next's cache/after hooks are stubbed. This checks the access rules in real SQL, which the existing stubbed-database test cannot.
- Tests cover every user story with a server-side rule: visibility in the loader; who may add, remove, leave, file in, take out and delete; items leaving with a person; cascades on account deletion; and the uniform "No such collection." refusals.
- Prior art: `src/app/stash/actions.test.ts` for stubbing Next and the session, and the real-Postgres check of the fetch budget in `test/instance.e2e.ts` for testing a rule against the database rather than a stub.
- The UI has no component tests in this repo. The rail marker, header, picker, Take out and Leave get checked by hand in the browser, at desktop and phone widths, with two accounts.

## Out of Scope

- Sharing a whole stash.
- "Save a copy" of someone else's item, or filing it into another collection.
- Editing someone else's item.
- An accept or decline step, notifications, emails, badges or activity of any kind.
- Handing the Creator role to someone else, and a Leave for the Creator.
- A cap on Collaborators.
- Renaming collections, which stash doesn't support yet for any collection.
- Sharing across instances, or with people who have no account on this one.

## Further Notes

- Decisions came from a grilling session on 2026-11-04. The terms are in CONTEXT.md, the ownership model is in ADR 0003, and principle 4 is amended in PRODUCT.md.
- Every account can see every other account's name and email in the picker. The user chose this knowingly: everyone on an instance got in by invite, so the circle is trusted.
