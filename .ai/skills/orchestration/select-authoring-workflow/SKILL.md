# Select Authoring Workflow

## Purpose

Choose the appropriate protocol for an authoring task **before** active-book resolution.

## When to Use

- User asks to write, outline, plan, review, or create a new book
- Task spans multiple authoring phases

## Required Inputs

- User request
- Optional book status from book.yaml (only if a book is already resolved)

## Workflow

1. Classify request: **new-book**, concept, bible, outline, scene, chapter, review, canon
2. Map to protocol in `.ai/protocols/protocols.md`
3. If new-book → `orchestration/initialize-book` (do not resolve existing active book first)
4. If existing-book → resolve book, then check `book.yaml` approval gates
5. Return recommended protocol and prerequisites

## Output

Selected protocol path and prerequisite checklist (including whether book resolution is deferred)

## Forbidden

- Jumping to prose without approved scene cards
- Skipping required review or approval gates
- Resolving the sole example/existing book when the user asked to create a new book

## Related

- Protocols: `.ai/protocols/protocols.md`
- Skills: `.ai/skills/orchestration/resolve-active-book/SKILL.md`
