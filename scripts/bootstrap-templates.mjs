#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function w(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content.endsWith("\n") ? content : content + "\n", "utf8");
}

w(".ai/templates/book.template.yaml", `id: book-slug
title: Untitled

status: planning

genre:
  primary: literary
  secondary: []

audience: adult
target_words: 80000

pov:
  mode: third-person-limited
  characters: []

tense: past

tone: []
prose:
  description: medium
  dialogue: medium
  introspection: medium

content:
  violence: none
  romance: none

structure:
  model: three-act

human_approval:
  premise: true
  story_bible: true
  macro_outline: true
  act_outline: false
  chapters: false
  scenes: false
  canon_retcon: true
`);

w(".ai/templates/premise.template.md", `# Premise

**Status:** PROPOSED

## Logline

<!-- One sentence -->

## Core Conflict

## Protagonist Situation

## Stakes

## Notes
`);

w(".ai/templates/character.template.md", `# Character: {Name}

**ID:** {slug}
**Status:** PROPOSED

## Role

## Goals
- External:
- Internal:

## Motivation

## Flaw

## Voice Notes

## Physical (significant traits only)

## Relationships

## Canon Notes
`);

w(".ai/templates/character-arc.template.md", `# Arc: {Name}

## Want / Need

## Ghost / Wound

## Arc Beats
| Act | Beat |
|-----|------|

## Resolution
`);

w(".ai/templates/location.template.md", `# Location: {Name}

**ID:** {slug}
**Status:** PROPOSED

## Overview

## Sensory Profile

## Plot Relevance

## Connected Factions / Characters
`);

w(".ai/templates/faction.template.md", `# Faction: {Name}

**ID:** {slug}
**Status:** PROPOSED

## Goals

## Methods

## Key Members

## Relationships
`);

w(".ai/templates/world-rule.template.md", `# World Rule: {Title}

**ID:** {slug}
**Status:** PROPOSED

## Rule Statement

## Scope

## Limitations / Costs

## Exceptions
`);

w(".ai/templates/story-architecture.template.md", `# Story Architecture

## Structure Model

## Act Summary
| Act | Purpose | Climax |
|-----|---------|--------|

## Main Plot

## Subplots

## Major Turning Points
`);

w(".ai/templates/act-outline.template.md", `# Act {N} Outline

## Act Goal

## Chapters
| Chapter | POV | Purpose |
|---------|-----|---------|

## Act Climax
`);

w(".ai/templates/chapter-outline.template.md", `# Chapter {N} Outline

## Purpose

## POV

## Beats
1.

## End Hook
`);

w(".ai/templates/scene-card.template.yaml", `scene_id: scene-0001
chapter: 1
sequence: 1

pov: character-slug
location: location-slug

participants: []

story_time:
  date:
  time:
  duration:

scene_goal:

conflict:

turn:

outcome:

emotional_start:
emotional_end:

information_revealed: []
information_withheld: []

threads_advanced: []
required_setup: []
prohibited_reveals: []

target_words: 1500
`);

w(".ai/templates/story-thread.template.md", `# Thread: {Title}

**ID:** {thread-id}
**State:** introduced

## Type
<!-- main | subplot | mystery | promise | secret | foreshadowing -->

## Description

## Introduced In

## Related Characters

## Setup / Payoff Links

## Notes
`);

w(".ai/templates/setup-payoff.template.md", `# Setup/Payoff: {Title}

**Setup ID:**
**Payoff ID:**

## Setup Location

## Intended Payoff

## Status
`);

w(".ai/templates/canon-proposal.template.md", `# Canon Proposal

**Fact:**
**Status:** PROPOSED
**Proposed By:**
**Date:**

## Evidence / Justification

## Affected Artifacts

## Contradictions (if any)
`);

w(".ai/templates/canon-change.template.md", `# Canon Change Record

**Change ID:**
**Date:**
**Authorized By:**

## Previous State

## New State

## Reason

## Retcon Notes
`);

w(".ai/templates/state-event.template.json", `{
  "schema_version": "1.0",
  "event_id": "scene-0001",
  "scene_id": "scene-0001",
  "sequence": 1,
  "status": "canon",
  "story_time": {},
  "changes": {
    "characters": {},
    "threads": {},
    "knowledge": {},
    "world": {},
    "inventory": {},
    "timeline": [],
    "canon_facts": []
  }
}
`);

w(".ai/templates/review.template.yaml", `status: PASS

findings: []

summary:
  major: 0
  minor: 0

recommended_action: approve
`);

w(".ai/templates/revision-report.template.md", `# Revision Report

**Scene/Chapter:**
**Date:**

## Findings Addressed

## Changes Made

## Remaining Issues
`);

w(".ai/templates/research-note.template.md", `# Research: {Topic}

**Date:**
**Confidence:** high | medium | low

## Question

## Findings

## Sources

## Application to Story
<!-- Fictional use only unless promoted to canon -->
`);

w(".ai/templates/handoff.template.md", `# Handoff

**From:**
**To:**
**Date:**

## Context

## Completed

## Next Steps

## Blockers
`);

w(".ai/templates/agent-delegation.template.md", `# Agent Delegation Brief

**Agent Role:**
**Protocol:**

## Task

## Allowed Actions (from agent definition)

## Constraints

## Inputs Attached

## Expected Output Format
`);

w(".ai/templates/change-request.template.md", `# CHANGE_REQUEST

**Scene ID:**
**Author:**

## Problem

## Proposal

## Impact
- 

## Alternatives Considered
`);

w(".ai/templates/skill.template.md", `# Skill Name

## Purpose

## When to Use

## Required Inputs

## Workflow

## Output

## Forbidden

## Related
`);

w(".ai/templates/protocol.template.md", `# Protocol Name

## Trigger

## Flow

## Agents

## Skills

## Rules

## Outputs
`);

w(".ai/templates/agent.template.md", `# Agent Name

## Purpose

## Best Used For

## Allowed Actions

## Not Allowed

## Inputs Expected

## Output Format

## Related Skills

## Related Protocols

## Related Rules
`);

// Schemas
w(".ai/schemas/book.schema.json", JSON.stringify({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://ai-author-orchestration.dev/schemas/book.schema.json",
  "title": "Book Configuration",
  "type": "object",
  "required": ["id", "title", "status", "genre"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "title": { "type": "string" },
    "status": { "enum": ["planning", "outlining", "drafting", "revising", "complete"] },
    "genre": {
      "type": "object",
      "required": ["primary"],
      "properties": {
        "primary": { "type": "string" },
        "secondary": { "type": "array", "items": { "type": "string" } }
      }
    },
    "audience": { "type": "string" },
    "target_words": { "type": "integer", "minimum": 0 },
    "pov": {
      "type": "object",
      "properties": {
        "mode": { "type": "string" },
        "characters": { "type": "array", "items": { "type": "string" } }
      }
    },
    "tense": { "type": "string" },
    "human_approval": { "type": "object", "additionalProperties": { "type": "boolean" } }
  },
  "additionalProperties": true
}, null, 2));

w(".ai/schemas/scene-card.schema.json", JSON.stringify({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Scene Card",
  "type": "object",
  "required": ["scene_id", "pov", "scene_goal", "conflict", "outcome"],
  "properties": {
    "scene_id": { "type": "string", "pattern": "^scene-[0-9]+$" },
    "chapter": { "type": "integer" },
    "sequence": { "type": "integer" },
    "pov": { "type": "string" },
    "location": { "type": "string" },
    "participants": { "type": "array", "items": { "type": "string" } },
    "scene_goal": { "type": "string" },
    "conflict": { "type": "string" },
    "turn": { "type": "string" },
    "outcome": { "type": "string" },
    "threads_advanced": { "type": "array", "items": { "type": "string" } },
    "prohibited_reveals": { "type": "array", "items": { "type": "string" } },
    "target_words": { "type": "integer" }
  },
  "additionalProperties": true
}, null, 2));

w(".ai/schemas/story-event.schema.json", JSON.stringify({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Story State Event",
  "type": "object",
  "required": ["schema_version", "event_id", "scene_id", "status", "changes"],
  "properties": {
    "schema_version": { "type": "string" },
    "event_id": { "type": "string" },
    "scene_id": { "type": "string" },
    "sequence": { "type": "integer" },
    "status": { "enum": ["canon", "retconned"] },
    "story_time": { "type": "object" },
    "changes": {
      "type": "object",
      "properties": {
        "characters": { "type": "object" },
        "threads": { "type": "object" },
        "knowledge": { "type": "object" },
        "world": { "type": "object" },
        "inventory": { "type": "object" },
        "timeline": { "type": "array" },
        "canon_facts": { "type": "array" }
      }
    }
  },
  "additionalProperties": true
}, null, 2));

w(".ai/schemas/review-result.schema.json", JSON.stringify({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Review Result",
  "type": "object",
  "required": ["status", "findings", "summary", "recommended_action"],
  "properties": {
    "status": { "enum": ["PASS", "WARN", "FAIL"] },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["severity", "category", "description"],
        "properties": {
          "severity": { "enum": ["major", "minor", "info"] },
          "category": { "type": "string" },
          "location": { "type": "string" },
          "description": { "type": "string" },
          "recommended_action": { "type": "string" }
        }
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "major": { "type": "integer" },
        "minor": { "type": "integer" }
      }
    },
    "recommended_action": { "enum": ["approve", "revise", "reject"] }
  }
}, null, 2));

w(".ai/schemas/canon-proposal.schema.json", JSON.stringify({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Canon Proposal",
  "type": "object",
  "required": ["fact", "status"],
  "properties": {
    "fact": { "type": "string" },
    "status": { "enum": ["PROPOSED", "CANON", "DEPRECATED", "RETCONNED", "UNKNOWN"] },
    "justification": { "type": "string" }
  }
}, null, 2));

w(".ai/schemas/story-thread.schema.json", JSON.stringify({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Story Thread",
  "type": "object",
  "required": ["id", "state"],
  "properties": {
    "id": { "type": "string" },
    "title": { "type": "string" },
    "type": { "type": "string" },
    "state": { "enum": ["introduced", "active", "advanced", "dormant", "resolved", "abandoned"] },
    "description": { "type": "string" }
  }
}, null, 2));

// Harness adapters
const harnesses = ["cursor", "claude-code", "codex", "gemini-cli", "github-copilot", "opencode"];
for (const h of harnesses) {
  const name = h.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  w(`.ai/harnesses/${h}/README.md`, `# ${name} Adapter

**Harness:** ${name}
**Compatibility:** Drop-in via \`AGENTS.md\`

## Canonical Entry

1. \`AGENTS.md\` — root dispatcher
2. \`.ai/manifest.json\` — index
3. Dispatchers: rules, protocols, genres

## Semantic Agents

Agents are role contracts. Implement by:
- Native subagents (if available)
- Sequential role context switching
- Same model, different loaded agent definition

## Parallel Review

Map manuscript-review panel to parallel subagents or sequential role adoption.

## Important

- Do **not** duplicate \`.ai/\` instructions in harness config
- Harness files are thin pointers only
- Source of truth: \`.ai/\`

${h === "cursor" ? `
## Cursor Setup

Create minimal \`.cursor/rules/author-orchestration.mdc\` pointing to \`AGENTS.md\`:

\`\`\`markdown
---
description: AI Author Orchestration entrypoint
alwaysApply: true
---
Read and follow AGENTS.md as the root dispatcher. Load .ai/ selectively via dispatchers only.
\`\`\`
` : ""}
`);
}

w(".ai/memory/README.md", `# Framework Memory

This directory documents **framework-level** durable context — not book canon.

Book-specific truth lives under \`books/<book>/canon/\` and \`books/<book>/state/\`.

## vs Book State

| Framework memory | Book state |
|------------------|------------|
| How the OS works | What happened in the story |
| Rarely changes | Grows with each scene |
| \`.ai/memory/\` | \`books/<book>/state/events/\` |

## Event-Sourced Book State

See \`story_state_model\` in \`.ai/manifest.json\` and \`scripts/story-state/fold.ts\`.

*Event-sourced memory pattern adapted from AstrAI.*
`);

w(".ai/examples/end-to-end-flow.md", `# End-to-End Example Flow

**User request:** Create an adult science-fiction mystery novel about a colony ship where people's memories are being altered.

## Flow

\`\`\`text
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
\`\`\`

See \`books/memory-echo/\` for a minimal worked example with artifacts.
`);

w("docs/architecture.md", `# Architecture Overview

See README.md and AGENTS.md for the full model.

## Core Hierarchy

\`\`\`text
.ai/           — How AI participants behave
books/<book>/  — What the book is and contains
scripts/       — Deterministic tooling (fold, validate)
\`\`\`

## Immutable History + Deterministic Reconstruction

\`state/events/\` + fold → \`state/derived/\`

Do not hand-edit derived files.
`);

console.log("Templates, schemas, harnesses, examples created");
