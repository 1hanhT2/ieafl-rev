import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'bttbuitanthanh@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory startup connection check
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export type SkillId = 'reading' | 'listening' | 'writing' | 'speaking';

export interface UserProfile {
  uid: string;
  displayName: string;
  targetBand: number;
  examDate: string;
  completedRoadmapSteps: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AttemptRecord {
  id: string;
  uid: string;
  skill: SkillId;
  testId: string;
  testTitle: string;
  band: number;
  scoreText: string;
  durationSec: number;
  summary: string;
  createdAtMs: number;
}

export interface CustomTestRecord {
  id: string;
  skill: SkillId;
  source: string;
  title: string;
  prompt: string;
  published: boolean;
  authorUid: string;
  createdAtMs: number;
  updatedAtMs: number;
}

function clampString(val: string, maxLen: number, fallback = 'Untitled'): string {
  const trimmed = String(val || '').trim();
  const safe = trimmed.length > 0 ? trimmed : fallback;
  return safe.slice(0, maxLen);
}

function sanitizeId(raw: string, maxLen = 64): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : `id-${Date.now()}`;
}

function sanitizeExamDate(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '2026-12-20';
}

function sanitizeRoadmapSteps(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  const out: string[] = [];
  for (const item of steps) {
    if (typeof item === 'string') {
      const s = item.trim().slice(0, 32);
      if (s.length > 0 && !out.includes(s)) out.push(s);
    }
    if (out.length >= 24) break;
  }
  return out;
}

function tsToMs(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

// Exclusive Google Sign-In via Firebase Auth Popup
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function listenAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function ensureUserProfile(
  user: User,
  localRoadmapSteps: string[] = []
): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: String(data.uid || user.uid),
        displayName: clampString(String(data.displayName || user.displayName || 'Learner'), 120, 'Learner'),
        targetBand: typeof data.targetBand === 'number' ? data.targetBand : 7.5,
        examDate: sanitizeExamDate(String(data.examDate || '2026-12-20')),
        completedRoadmapSteps: sanitizeRoadmapSteps(data.completedRoadmapSteps),
      };
    }

    const initialSteps = sanitizeRoadmapSteps(localRoadmapSteps);
    const payload = {
      uid: user.uid,
      displayName: clampString(user.displayName || 'IELTS Learner', 120, 'IELTS Learner'),
      targetBand: 7.5,
      examDate: '2026-12-20',
      completedRoadmapSteps: initialSteps,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return {
      uid: payload.uid,
      displayName: payload.displayName,
      targetBand: payload.targetBand,
      examDate: payload.examDate,
      completedRoadmapSteps: payload.completedRoadmapSteps,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserGoals(
  uid: string,
  updates: { targetBand: number; examDate: string; displayName: string }
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const clampedBand = Math.min(9.0, Math.max(4.0, Math.round(updates.targetBand * 2) / 2));
  try {
    await updateDoc(ref, {
      displayName: clampString(updates.displayName, 120, 'IELTS Learner'),
      targetBand: clampedBand,
      examDate: sanitizeExamDate(updates.examDate),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncRoadmapSteps(uid: string, steps: string[]): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, {
      completedRoadmapSteps: sanitizeRoadmapSteps(steps),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAttempt(
  uid: string,
  input: {
    skill: SkillId;
    testId: string;
    testTitle: string;
    band: number;
    scoreText: string;
    durationSec: number;
    summary: string;
  }
): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 7);
  const attemptId = sanitizeId(`att-${Date.now()}-${rand}`, 64);
  const path = `users/${uid}/attempts/${attemptId}`;
  const ref = doc(db, 'users', uid, 'attempts', attemptId);
  const clampedBand = Math.min(9.0, Math.max(0.0, Math.round(input.band * 2) / 2));
  const clampedDuration = Math.min(14400, Math.max(0, Math.round(input.durationSec)));

  try {
    await setDoc(ref, {
      uid,
      skill: input.skill,
      testId: sanitizeId(input.testId, 64),
      testTitle: clampString(input.testTitle, 160, 'IELTS Practice Set'),
      band: clampedBand,
      scoreText: clampString(input.scoreText, 64, 'Completed'),
      durationSec: clampedDuration,
      summary: clampString(input.summary, 1000, 'Attempt submitted.'),
      createdAt: serverTimestamp(),
    });
    return attemptId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAttempt(uid: string, attemptId: string): Promise<void> {
  const safeId = sanitizeId(attemptId, 128);
  const path = `users/${uid}/attempts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'attempts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAttempts(
  uid: string,
  onData: (attempts: AttemptRecord[]) => void,
  onErr?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/attempts`;
  const q = query(collection(db, 'users', uid, 'attempts'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: AttemptRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid || uid),
          skill: (['reading', 'listening', 'writing', 'speaking'].includes(data.skill)
            ? data.skill
            : 'reading') as SkillId,
          testId: String(data.testId || ''),
          testTitle: String(data.testTitle || 'Practice Set'),
          band: typeof data.band === 'number' ? data.band : 0,
          scoreText: String(data.scoreText || ''),
          durationSec: typeof data.durationSec === 'number' ? data.durationSec : 0,
          summary: String(data.summary || ''),
          createdAtMs: tsToMs(data.createdAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onErr && wrapped instanceof Error) onErr(wrapped);
      }
    }
  );
}

export function subscribeTestBank(
  isAdminUser: boolean,
  onData: (items: CustomTestRecord[]) => void,
  onErr?: (err: Error) => void
): Unsubscribe {
  const path = 'testBank';
  const baseCol = collection(db, 'testBank');
  const q = isAdminUser ? query(baseCol) : query(baseCol, where('published', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items: CustomTestRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          skill: (['reading', 'listening', 'writing', 'speaking'].includes(data.skill)
            ? data.skill
            : 'writing') as SkillId,
          source: String(data.source || 'Cambridge Style'),
          title: String(data.title || 'Untitled Drill'),
          prompt: String(data.prompt || ''),
          published: Boolean(data.published),
          authorUid: String(data.authorUid || ''),
          createdAtMs: tsToMs(data.createdAt),
          updatedAtMs: tsToMs(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onErr && wrapped instanceof Error) onErr(wrapped);
      }
    }
  );
}

export async function createCustomTest(
  authorUid: string,
  input: {
    skill: SkillId;
    source: string;
    title: string;
    prompt: string;
    published: boolean;
  }
): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 6);
  const testId = sanitizeId(`${input.skill}-${Date.now()}-${rand}`, 64);
  const path = `testBank/${testId}`;
  try {
    await setDoc(doc(db, 'testBank', testId), {
      id: testId,
      skill: input.skill,
      source: clampString(input.source, 80, 'Cambridge Style'),
      title: clampString(input.title, 160, 'Custom Practice Drill'),
      prompt: clampString(input.prompt, 4000, 'Complete this IELTS task under timed constraints.'),
      published: Boolean(input.published),
      authorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return testId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleCustomTestPublish(testId: string, published: boolean): Promise<void> {
  const safeId = sanitizeId(testId, 64);
  const path = `testBank/${safeId}`;
  try {
    await updateDoc(doc(db, 'testBank', safeId), {
      published: Boolean(published),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomTest(testId: string): Promise<void> {
  const safeId = sanitizeId(testId, 64);
  const path = `testBank/${safeId}`;
  try {
    await deleteDoc(doc(db, 'testBank', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
