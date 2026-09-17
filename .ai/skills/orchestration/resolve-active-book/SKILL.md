# Resolve Active Book

## Purpose

Determine which book the current task targets.

## When to Use

- Task references a book ambiguously
- Multiple books exist in books/
- Harness needs active book context

## Required Inputs

- User request
- Optional explicit book slug or path

## Workflow

1. List books/ directories
2. Check user request for explicit book reference
3. Check environment variable BOOK_SLUG if present
4. Default to sole book if only one exists
5. Ask user if ambiguous

## Output

Resolved book slug and path to books/<slug>/

## Forbidden

- Guessing among multiple books without confirmation
- Mixing artifacts from different books

## Related

- Rules: project/active-book-resolution.md
- Skills: orchestration/load-book-context/SKILL.md
