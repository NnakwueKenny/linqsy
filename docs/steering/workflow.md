# Workflow Steering

## Mandatory Workflow

For meaningful work, follow this sequence:

1. Feature brief
2. ADR if required
3. Implementation task breakdown
4. Code implementation
5. Tests and QA checklist
6. Documentation updates

No step should be skipped.

## Definition Of Ready

A task is ready only when it has:

- completed feature brief
- clear in-scope and out-of-scope list
- affected apps/packages listed
- contracts listed
- acceptance criteria listed
- ADR completed if triggered

## Definition Of Done

A task is done only when:

- acceptance criteria pass
- required tests pass
- QA checklist is completed
- relevant steering docs updated when behavior/policy changed
- unresolved risks are documented

## Task Sizing

- Small: single layer, low-risk behavior, no new contract surface
- Medium: two layers or one new contract/event
- Large: cross-layer architecture or state-model changes

Medium and large tasks require feature brief updates before coding.

## Review Checklist

- boundaries respected (`cli` vs `server` vs `web` vs `shared`)
- no contract duplication
- error envelope consistency
- cleanup and failure paths covered
- mobile experience preserved
- docs and templates updated

## Quality Gates

- unit tests for pure logic
- integration tests for cross-layer behavior
- manual QA for mobile join and transfer path
- regression checks for reconnect and cleanup

## Documentation Gate

When changing behavior, update steering docs in the same change set.
Do not defer docs as a separate cleanup step.

## Frozen Decisions

- Feature briefs are mandatory for meaningful implementation work
- ADRs are mandatory for architecture-impacting decisions

## Requires ADR

- Any change that weakens or bypasses workflow gates
