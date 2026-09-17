# Synthesize Agent Findings

## Purpose

Merge and deduplicate outputs from multiple reviewers.

## When to Use

- Multi-agent review completed
- Parallel continuity and developmental reviews

## Required Inputs

- Review artifacts from each agent
- Review template schema

## Workflow

1. Collect findings by severity and category
2. Deduplicate overlapping issues
3. Identify conflicts between reviewers
4. Produce unified summary and recommended action

## Output

Synthesized review report per review.template.yaml

## Forbidden

- Letting one reviewer override another without noting conflict
- Rewriting prose during synthesis

## Related

- Protocols: review/manuscript-review.md
- Skills: editorial/manuscript-review/SKILL.md
