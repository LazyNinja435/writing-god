# Select Authoring Workflow

## Purpose

Choose the appropriate protocol for an authoring task.

## When to Use

- User asks to write, outline, plan, or review
- Task spans multiple authoring phases

## Required Inputs

- User request
- Book status from book.yaml

## Workflow

1. Classify request: concept, bible, outline, scene, chapter, review
2. Map to protocol in protocols dispatcher
3. Check book.yaml approval gates
4. Return recommended protocol and prerequisites

## Output

Selected protocol path and prerequisite checklist

## Forbidden

- Jumping to prose without approved scene cards
- Skipping required review protocols

## Related

- Protocols: protocols.md
- Skills: orchestration/resolve-active-book/SKILL.md
