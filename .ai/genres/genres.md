# Genre Dispatcher

> Load only genre packs listed in `books/<book>/book.yaml`. Genre packs are composable guidance — not separate frameworks.

## How to Use

1. Read `genre.primary` — load that pack's files
2. Read each `genre.secondary` entry — load those packs' files
3. Do not load unrelated packs

## Available Packs

| Genre | Path | Key Files |
|-------|------|-----------|
| fantasy | `.ai/genres/fantasy/` | worldbuilding.md, magic-systems.md, genre-expectations.md |
| science-fiction | `.ai/genres/science-fiction/` | worldbuilding.md, technology-systems.md, genre-expectations.md |
| mystery | `.ai/genres/mystery/` | clue-management.md, fair-play.md, reveal-structure.md, red-herrings.md |
| thriller | `.ai/genres/thriller/` | pacing-tension.md, stakes-escalation.md, genre-expectations.md |
| romance | `.ai/genres/romance/` | relationship-arc.md, emotional-beats.md, relationship-continuity.md |
| horror | `.ai/genres/horror/` | tension.md, reveal-control.md, fear-escalation.md |
| literary | `.ai/genres/literary/` | character-interiority.md, thematic-density.md, genre-expectations.md |

## Precedence

Book configuration (`book.yaml`, `narrative-style.md`) overrides genre guidance unless a genre file marks a constraint as **hard**.
