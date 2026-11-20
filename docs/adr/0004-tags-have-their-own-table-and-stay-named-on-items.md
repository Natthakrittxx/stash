# Tags have their own table, and items keep their tag names

A tag can exist before any item uses it, so each account's tags live as rows in their own `stash.tags` table. Every item also keeps the names of its tags in its `tags` array, as it did before tags could stand alone. Item reads, search, filters and undo already work from that array, and none of them had to change. Renaming or deleting a tag rewrites the array on every one of its account's items, in the same transaction as the change to the tag's row.

## Considered Options

- **A link table in place of the array:** a rename touches one row and the names cannot drift. But every item read, save, undo and test would have to change, which made this several times the diff.
- **No table; tags only as names on items:** the smallest change, but a tag would disappear when the last item dropped it, so it could never be made ahead of time.

## Consequences

A tag's name appears in two places, and a write that skips the server actions can leave an item naming a tag that has no row. Saving an item creates a row for each new name on it, so typing a new name still works. The upgrade migration lowercases every existing tag, merges duplicates on each item, and creates one row per account for each name already in use.
