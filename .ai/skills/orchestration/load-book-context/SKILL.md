# Load Book Context

## Purpose

Selectively load book context for a specific task.

## When to Use

- Before scene writing, review, or continuity check
- Context window is limited

## Required Inputs

- Resolved book slug
- Task type (scene-write, review, etc.)
- Relevant entity IDs (characters, locations, threads)

## Workflow

1. Read book.yaml for configuration
2. Apply context-selection rules for task type
3. Load scene card if scene task
4. Load POV character canon and knowledge state
5. Load participating characters, location, world rules
6. Load active threads and previous scene summary only
7. Do not load full manuscript by default

## Output

Focused context bundle: paths and summaries of loaded artifacts

## Forbidden

- Loading entire manuscript for routine scene work
- Loading all canon files unconditionally

## Related

- Rules: project/context-loading.md
- Protocols: authoring/write-scene.md
