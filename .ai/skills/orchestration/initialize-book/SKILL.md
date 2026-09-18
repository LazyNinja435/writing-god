# Initialize Book

## Purpose

Create a new book workspace from a concept.

## When to Use

- User requests a new book or novel project
- Starting from scratch with a story concept

## Required Inputs

- Story concept or brief
- Optional genre/audience preferences

## Workflow

1. Confirm new-book protocol (do not bind to existing/example books)
2. Resolve book slug and check `books/` for conflicts
3. Copy book template structure including `approvals/`, `manuscript/drafts/`, `manuscript/scenes/`, `state/events/`, `state/initial.json`
4. Create `book.yaml` from template
5. Record initial configuration
6. Resolve the newly created book as active

## Output

New book directory under `books/<slug>/` with `book.yaml` and folder structure

## Forbidden

- Skipping human approval gates configured in book.yaml
- Creating canon facts without canon workflow
- Using `.ai/examples/books/*` as the destination or as a false active book

## Related

- Rules: `.ai/rules/project/active-book-resolution.md`
- Protocols: `.ai/protocols/orchestration/initialize-book.md`
- Templates: `.ai/templates/book.template.yaml`
