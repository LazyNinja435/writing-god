# End-to-End Example Flow

**User request:** Create an adult science-fiction mystery novel about a colony ship where people's memories are being altered.

## Flow

```text
user concept
  → initialize-book protocol
  → genre: science-fiction (primary), mystery (secondary)
  → create-premise → premise.md
  → human approval
  → concept-to-bible protocol
  → characters (Dr. Sera Voss, Marcus Hale)
  → world (Mnemosyne colony ship, memory audit rule)
  → create-story-bible
  → bible-to-outline → architecture, threads
  → outline-to-scene-graph → scene cards
  → write-scene protocol (scene-0001)
  → continuity + developmental review
  → approved manuscript scene
  → extract-scene-events → immutable event
  → fold → derived state
  → next scene
```

See `books/memory-echo/` for a minimal worked example with artifacts.
