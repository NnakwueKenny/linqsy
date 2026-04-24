# Agent Steering

## Goal

Enable high-signal, low-churn implementation by reducing repeated questions and context resets.

## Mandatory Read Order

Before coding, agent reads:

1. `STEERING.md`
2. domain steering doc(s) relevant to task
3. feature brief for current task
4. ADR(s), if any

## Assumption Rules

Agents may assume:

- frozen stack decisions
- frozen architecture boundaries
- frozen product scope

Agents must ask before proceeding only when:

- requested change conflicts with frozen decisions
- behavior tradeoff is user-facing and ambiguous
- there is conflicting source-of-truth guidance

## Question-Minimization Rules

- Do not ask for stack choice already frozen
- Do not ask for architecture split already documented
- Do not ask for styling direction already captured in design-system steering
- Group unresolved questions into one concise checkpoint instead of many small interruptions

## Required Task Output Format

For each meaningful implementation task, include:

- summary
- touched layers
- contract changes
- behavior changes
- tests run
- assumptions taken
- risks or follow-up notes

## Context Preservation Rules

- Keep feature brief updated with final assumptions
- Keep ADR links in implementation notes
- Keep naming and event contracts aligned with shared docs

## Forbidden Behaviors

- silently overriding frozen decisions
- introducing major dependencies without ADR
- implementing new behavior without acceptance criteria
- duplicating schemas outside `packages/shared`

## Frozen Decisions

- Agents must treat steering docs as implementation authority
- Agents must optimize for fewer, higher-value clarifications

## Requires ADR

- Changes to agent governance rules that alter decision authority or workflow gates
