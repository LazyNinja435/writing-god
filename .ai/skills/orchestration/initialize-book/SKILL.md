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

1. Resolve book slug and check books/ for conflicts
2. Copy book template structure
3. Create book.yaml from template
4. Initialize canon/planning/state directories
5. Record initial configuration

## Output

New book directory under books/<slug>/ with book.yaml and folder structure

## Forbidden

- Skipping human approval gates configured in book.yaml
- Creating canon facts without canon workflow

## Related

- Rules: project/active-book-resolution.md
- Protocols: orchestration/initialize-book.md
- Templates: book.template.yaml
