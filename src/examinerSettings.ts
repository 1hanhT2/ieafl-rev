import type { BuiltInAvatarId, ExaminerCameraPreset } from './examiner3d';
import type { LiveExamMode, LiveVoiceName } from './liveSpeaking';

export const EXAMINER_SETTINGS_KEY = 'ieafl.examinerSettings';
export const EXAMINER_SETTINGS_EVENT = 'ieafl:examiner-settings-changed';

export const EXAMINER_VOICES: Array<{ id: LiveVoiceName; label: string; note: string }> = [
  { id: 'Zephyr', label: 'Zephyr', note: 'Bright, warm IELTS interviewer' },
  { id: 'Kore', label: 'Kore', note: 'Composed, crisp academic tone' },
  { id: 'Charon', label: 'Charon', note: 'Deep, calm senior examiner' },
  { id: 'Puck', label: 'Puck', note: 'Upbeat, clear conversational tone' },
  { id: 'Fenrir', label: 'Fenrir', note: 'Steady, authoritative debate panel' },
];

export interface ExaminerSettings {
  avatarPreset: BuiltInAvatarId | 'custom';
  customAvatarUrl: string;
  customAvatarName: string;
  voiceName: LiveVoiceName;
  cameraPreset: ExaminerCameraPreset;
  silenceDelaySec: number;
  autoAdvance: boolean;
  settingsVersion?: number;
}

const SETTINGS_VERSION = 2;

const DEFAULT_SETTINGS: ExaminerSettings = {
  avatarPreset: 'examiner-a',
  customAvatarUrl: '',
  customAvatarName: '',
  voiceName: 'Zephyr',
  cameraPreset: 'front',
  silenceDelaySec: 7.0,
  autoAdvance: true,
  settingsVersion: SETTINGS_VERSION,
};

// --- Shared IndexedDB helpers for custom uploaded .VRM / .GLB files ---
const IDB_NAME = 'ieafl-avatar-studio';
const IDB_STORE = 'avatars';
const IDB_KEY = 'active-custom-avatar';

export interface StoredCustomAvatar {
  name: string;
  buffer: ArrayBuffer;
  savedAt: number;
}

function openAvatarDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCustomAvatarToDb(name: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openAvatarDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ name, buffer, savedAt: Date.now() }, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadCustomAvatarFromDb(): Promise<StoredCustomAvatar | null> {
  const db = await openAvatarDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as StoredCustomAvatar) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteCustomAvatarFromDb(): Promise<void> {
  const db = await openAvatarDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function getExaminerSettings(): ExaminerSettings {
  try {
    const raw = window.localStorage.getItem(EXAMINER_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ExaminerSettings>;
    const validPreset: BuiltInAvatarId | 'custom' =
      parsed.avatarPreset === 'examiner-b' || parsed.avatarPreset === 'custom'
        ? parsed.avatarPreset
        : 'examiner-a';
    const validVoice: LiveVoiceName = EXAMINER_VOICES.some((v) => v.id === parsed.voiceName)
      ? (parsed.voiceName as LiveVoiceName)
      : 'Zephyr';
    const validCam: ExaminerCameraPreset =
      parsed.cameraPreset === 'closeup' || parsed.cameraPreset === 'desk'
        ? parsed.cameraPreset
        : 'front';
    const rawSilenceVal = Number(parsed.silenceDelaySec);
    // Migrate legacy v1 3.5s default up to the new 7.0s default cleanly
    const migratedSilenceVal =
      parsed.settingsVersion !== SETTINGS_VERSION && Math.abs(rawSilenceVal - 3.5) < 0.05
        ? DEFAULT_SETTINGS.silenceDelaySec
        : rawSilenceVal;
    const validSilence =
      Number.isFinite(migratedSilenceVal) && migratedSilenceVal >= 3.0 && migratedSilenceVal <= 15.0
        ? Math.round(migratedSilenceVal * 10) / 10
        : DEFAULT_SETTINGS.silenceDelaySec;
    return {
      avatarPreset: validPreset,
      customAvatarUrl: typeof parsed.customAvatarUrl === 'string' ? parsed.customAvatarUrl : '',
      customAvatarName: typeof parsed.customAvatarName === 'string' ? parsed.customAvatarName : '',
      voiceName: validVoice,
      cameraPreset: validCam,
      silenceDelaySec: validSilence,
      autoAdvance: parsed.autoAdvance !== false,
      settingsVersion: SETTINGS_VERSION,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveExaminerSettings(patch: Partial<ExaminerSettings>): ExaminerSettings {
  const next: ExaminerSettings = {
    ...getExaminerSettings(),
    ...patch,
    settingsVersion: SETTINGS_VERSION,
  };
  try {
    window.localStorage.setItem(EXAMINER_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failure
  }
  window.dispatchEvent(new CustomEvent(EXAMINER_SETTINGS_EVENT, { detail: next }));
  return next;
}

export async function uploadCustomAvatarFromSettings(file: File): Promise<ExaminerSettings> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.vrm') && !lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
    throw new Error('Unsupported avatar file. Please upload a .vrm, .glb, or .gltf model.');
  }
  const buffer = await file.arrayBuffer();
  await saveCustomAvatarToDb(file.name, buffer);
  return saveExaminerSettings({
    avatarPreset: 'custom',
    customAvatarUrl: '',
    customAvatarName: file.name,
  });
}

export async function setCustomAvatarUrlFromSettings(url: string): Promise<ExaminerSettings> {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean) && !clean.startsWith('/')) {
    throw new Error('Please enter a valid https:// URL pointing directly to a .vrm or .glb model.');
  }
  await deleteCustomAvatarFromDb();
  const inferredName = clean.split('/').pop()?.split('?')[0] || 'Custom Avatar URL';
  return saveExaminerSettings({
    avatarPreset: 'custom',
    customAvatarUrl: clean,
    customAvatarName: inferredName,
  });
}

export async function selectBuiltInAvatarFromSettings(
  presetId: BuiltInAvatarId
): Promise<ExaminerSettings> {
  await deleteCustomAvatarFromDb();
  return saveExaminerSettings({
    avatarPreset: presetId,
    customAvatarUrl: '',
    customAvatarName: '',
  });
}

// --- Client helper for server-side Gemini 3.8 Flash Lite TTS ---
export async function requestGeminiTtsWav(
  text: string,
  voiceName: LiveVoiceName,
  examMode: LiveExamMode = 'ielts',
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceName, examMode }),
    signal,
  });
  const data = (await res.json()) as {
    audioBase64?: string;
    mimeType?: string;
    error?: string;
  };
  if (!res.ok || !data.audioBase64) {
    throw new Error(data.error || 'Could not synthesize examiner voice.');
  }
  const binary = atob(data.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

let activePreviewAudio: HTMLAudioElement | null = null;
let activePreviewUrl: string | null = null;

export function stopVoicePreview(): void {
  if (activePreviewAudio) {
    try {
      activePreviewAudio.pause();
      activePreviewAudio.src = '';
    } catch {
      // ignore
    }
    activePreviewAudio = null;
  }
  if (activePreviewUrl) {
    URL.revokeObjectURL(activePreviewUrl);
    activePreviewUrl = null;
  }
}

export async function previewExaminerVoice(voiceName: LiveVoiceName): Promise<void> {
  stopVoicePreview();
  const sample = `Hello, I am your ${voiceName} speaking examiner. Take a breath, speak naturally, and I will never interrupt your answer.`;
  const wavBuf = await requestGeminiTtsWav(sample, voiceName, 'ielts');
  const blob = new Blob([wavBuf], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  activePreviewUrl = url;
  const audio = new Audio(url);
  activePreviewAudio = audio;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      stopVoicePreview();
      resolve();
    };
    audio.onerror = () => {
      stopVoicePreview();
      reject(new Error('Browser could not play the synthesized voice preview.'));
    };
    void audio.play().catch((err) => {
      stopVoicePreview();
      reject(err);
    });
  });
}
