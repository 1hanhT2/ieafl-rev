# ieafl Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Verified Google Identity Only**: Every authenticated read/write requires `request.auth != null && request.auth.token.email_verified == true`.
2. **Strict Profile Isolation**: `/users/{userId}` documents contain zero PII (`email`, `phone`, `address`) and are strictly readable/writable only by `request.auth.uid == userId` (or verified admin). Collection-wide listing of `/users` is denied.
3. **Master Gate on Attempts**: An attempt under `/users/{userId}/attempts/{attemptId}` cannot be created unless the parent `/users/{userId}` document exists (`exists(...)`) and `incoming().uid == request.auth.uid == userId`.
4. **Attempt Immutability**: Practice attempt records are append-only (`allow update: if false;`) so historical IELTS band scores cannot be silently rewritten.
5. **Admin-Only Test Bank Writes**: Only verified administrators (`isAdmin()`) may create, edit, or delete `/testBank/{testId}` entries. Verified learners may only read items where `published == true`.
6. **Temporal Integrity & Field Bounds**: All `createdAt`/`updatedAt` timestamps must match `request.time`; all string/array fields enforce explicit `.size()` ceilings matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Unauthenticated Read** — Unauthenticated client attempts `get /users/alice`.
2. **Unverified Email Write** — Authenticated user with `email_verified: false` tries to create `/users/alice`.
3. **Cross-User Profile Spoof** — User `bob` attempts to read or update `/users/alice`.
4. **Shadow Ghost Field Injection** — User `alice` creates `/users/alice` with extra field `isAdmin: true` or `role: "admin"`.
5. **Immutable Timestamp Tampering** — User `alice` updates `/users/alice` and alters `createdAt` or sets `updatedAt` to a client-forged past timestamp.
6. **Array Overflow / Type Poisoning** — User `alice` writes `completedRoadmapSteps` with 30 entries (> 24 max) or non-string element `[123]`.
7. **Orphaned Attempt Creation** — User `alice` tries to create `/users/alice/attempts/att1` before `/users/alice` exists.
8. **Attempt Identity Spoofing** — User `alice` tries to create `/users/alice/attempts/att1` with `uid: "bob"`.
9. **Attempt Score Rewrite** — User `alice` tries to `update` an existing attempt in `/users/alice/attempts/att1` to inflate `band: 9.0`.
10. **Non-Admin Test Bank Injection** — Regular verified user `alice` attempts to `create` `/testBank/fake-test`.
11. **Admin Email Spoof Without Verification** — Attacker with `email: "bttbuitanthanh@gmail.com"` and `email_verified: false` attempts to write `/testBank/spoof`.
12. **Document ID Poisoning & Value Poisoning** — User attempts to write `/users/alice/attempts/invalid$id!!` (fails `isValidId`) or passes a 2KB string into `testTitle` (`> 160`).
