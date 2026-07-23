# 2026-07-23

- Goal: Land the exec-board scaffolding and start the codec
- Type: day
- Sessions: 1
- Date: 2026-07-23
- Deadline: 2026-07-24
- Columns: due, prio, owner

## Board

### Exec Board

1. [x] Scaffold Next.js + workspaces `prio:high owner:jaxz`
2. [~] Write board-codec `due:2026-07-23 prio:high owner:jaxz`
   2.1. [x] Types and numbering
   2.2. [ ] Parser and serializer

### Household

3. [ ] Renew the ngrok reserved domain `owner:jayci`

## Blockers

- 2: fast-check arbitrary for nested groups kept generating ambiguous trees — unblock: constrain root order to steps-then-groups

## Scope changes

- CUT 4 — dropped the FR-7 two-doing escape hatch per the TRD's own recommendation

## Notes

- 1: went with npm workspaces instead of a separate repo so board-codec stays in lockstep with the app

## Waiting on

- 3 (jayci) — needs the billing details for the reserved domain
