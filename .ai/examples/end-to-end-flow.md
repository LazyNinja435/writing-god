# End-to-End Example Flow

**User request:** Create an adult science-fiction mystery novel about a colony ship where people's memories are being altered.

## Flow

```text
select protocol: initialize-book  (do NOT resolve existing/example books)
  → create books/<slug>/
  → resolve newly created book
  → genre: science-fiction (primary), mystery (secondary)
  → create-premise → premise.md
  → human approval + approvals/*.json
  → concept-to-bible protocol
  → characters (Dr. Sera Voss, Marcus Hale)
  → world (Mnemosyne colony ship, memory audit rule)
  → create-story-bible
  → bible-to-outline → architecture, threads
  → outline-to-scene-graph → scene cards
  → write-scene protocol (scene-0001)
      draft → manuscript/drafts/
      proposed state deltas
      continuity + developmental review
      human approval (if configured) → approvals/
      promote → manuscript/scenes/
      event evt-000001 → state/events/
      optional canon proposal → canon/proposals/
      fold → state/derived/
  → next scene
```

See `.ai/examples/books/memory-echo/` for a minimal worked example (example-only; not an active book).
