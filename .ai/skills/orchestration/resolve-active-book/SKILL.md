# Resolve Active Book

## Purpose

Determine which book the current task targets.

## When to Use

- Existing-book tasks after protocol selection
- After initialize-book creates a new workspace
- Multiple books exist under `books/`

## Required Inputs

- User request
- Selected protocol (new-book vs existing-book)
- Optional explicit book slug or path

## Workflow

1. If protocol is new-book / initialize-book: **skip** resolving existing books; create first; then resolve the new slug
2. List `books/` directories only (never `.ai/examples/books/`)
3. Check user request for explicit book reference
4. Check environment variable `BOOK_SLUG` if present
5. Default to sole book under `books/` if exactly one exists
6. Ask user if ambiguous

## Output

Resolved book slug and path to `books/<slug>/`

## Forbidden

- Guessing among multiple books without confirmation
- Mixing artifacts from different books
- Treating example books as the active book for "create a new novel"

## Related

- Rules: `.ai/rules/project/active-book-resolution.md`
- Skills: `.ai/skills/orchestration/load-book-context/SKILL.md`
- Skills: `.ai/skills/orchestration/select-authoring-workflow/SKILL.md`
