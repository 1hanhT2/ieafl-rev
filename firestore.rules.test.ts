/**
 * Phase 0 Security TDD Specification for ieafl Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads defined in security_spec.md
 * against the Eight Pillars enforced in firestore.rules.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read of User Profile',
    operation: 'get',
    path: '/users/alice',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Profile Create',
    operation: 'create',
    path: '/users/alice',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: false },
    payload: {
      uid: 'alice',
      displayName: 'Alice',
      targetBand: 7.5,
      examDate: '2026-12-15',
      completedRoadmapSteps: [],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User Profile Read',
    operation: 'get',
    path: '/users/alice',
    auth: { uid: 'bob', email: 'bob@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Ghost Field (isAdmin) Injection',
    operation: 'create',
    path: '/users/alice',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: true },
    payload: {
      uid: 'alice',
      displayName: 'Alice',
      targetBand: 8.0,
      examDate: '2026-12-15',
      completedRoadmapSteps: [],
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Immutable createdAt Tampering on Update',
    operation: 'update',
    path: '/users/alice',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Roadmap Steps Array Overflow & Type Poisoning',
    operation: 'update',
    path: '/users/alice',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: true },
    payload: {
      completedRoadmapSteps: [123, ...Array.from({ length: 26 }, (_, i) => `m${i}`)],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Attempt Creation Without Parent Profile',
    operation: 'create',
    path: '/users/ghostUser/attempts/att-1',
    auth: { uid: 'ghostUser', email: 'ghost@example.com', email_verified: true },
    payload: {
      uid: 'ghostUser',
      skill: 'reading',
      testId: 'cam20-r1',
      testTitle: 'Cambridge 20 Reading',
      band: 7.5,
      scoreText: '7/8',
      durationSec: 420,
      summary: 'Completed passage',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Attempt Owner UID Spoofing',
    operation: 'create',
    path: '/users/alice/attempts/att-2',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: true },
    payload: {
      uid: 'bob',
      skill: 'listening',
      testId: 'cam20-l1',
      testTitle: 'Cambridge 20 Listening',
      band: 8.0,
      scoreText: '6/6',
      durationSec: 300,
      summary: 'Spoofed uid',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Attempt Score Mutation After Submission',
    operation: 'update',
    path: '/users/alice/attempts/att-1',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: true },
    payload: { band: 9.0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Non-Admin Test Bank Creation',
    operation: 'create',
    path: '/testBank/fake-test',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: true },
    payload: {
      id: 'fake-test',
      skill: 'writing',
      source: 'Unauthorized',
      title: 'Injected Prompt',
      prompt: 'Malicious test body',
      published: true,
      authorUid: 'alice',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unverified Bootstrapped Admin Email Spoof',
    operation: 'create',
    path: '/testBank/spoof-test',
    auth: { uid: 'attacker', email: 'bttbuitanthanh@gmail.com', email_verified: false },
    payload: {
      id: 'spoof-test',
      skill: 'speaking',
      source: 'Spoofed',
      title: 'Spoofed Prompt',
      prompt: 'Test body',
      published: true,
      authorUid: 'attacker',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Document ID Poisoning & Oversized Title',
    operation: 'create',
    path: '/users/alice/attempts/bad$id!!',
    auth: { uid: 'alice', email: 'alice@example.com', email_verified: true },
    payload: {
      uid: 'alice',
      skill: 'reading',
      testId: 'cam20-r1',
      testTitle: 'X'.repeat(400),
      band: 7.0,
      scoreText: '5/8',
      durationSec: 600,
      summary: 'Oversized title attack',
    },
    expected: 'PERMISSION_DENIED',
  },
];
