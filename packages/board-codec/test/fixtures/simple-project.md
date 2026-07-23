# Ludo Clash

- Goal: Ship the multiplayer lobby end to end
- Type: project
- Sessions: 3

## Board

1. [x] Set up the lobby socket server
2. [~] Trigger predicate in move resolver
   > done: move resolver rejects illegal moves and broadcasts the resulting state
   2.1. [x] Write failing test for illegal-move rejection
   2.2. [ ] Implement the predicate
3. [!] Prisma migration fails on enum rename
4. [ ] Wire the lobby UI to the socket events

## Blockers

- 3: Prisma migration fails on enum rename — unblock: drop and recreate the enum in a manual migration

## Notes

- 2: Went with a pure predicate function instead of a class so it's trivially testable
