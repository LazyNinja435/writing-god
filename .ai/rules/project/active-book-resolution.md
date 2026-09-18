# Active Book Resolution

## Order

1. **Select the protocol first** (new-book vs existing-book).
2. Only then resolve a book if the protocol needs an existing workspace.

## New-book (`orchestration/initialize-book`)

1. Do **not** bind to an existing book under `books/`.
2. Create `books/<new-slug>/`.
3. Resolve the newly created book for subsequent steps.

## Existing-book

1. List `books/*` directories (exclude hidden entries and non-book files).
2. **Exclude** `.ai/examples/books/*` — examples are never active books.
3. Prefer explicit slug/title in the user request.
4. Else use `BOOK_SLUG` if set.
5. If exactly one book exists under `books/`, use it.
6. If multiple and none specified, ask the user.
7. Never mix books in one task.

## Forbidden

- Resolving `memory-echo` (or any example) as the active book merely because it is the only discovered tree when the user asked to create a new novel
- Treating example paths as user workspaces
