import type { User } from 'firebase/auth';
import {
  signInWithGoogle,
  signOutUser,
  saveAttempt,
  deleteAttempt,
  updateUserGoals,
  createCustomTest,
  toggleCustomTestPublish,
  deleteCustomTest,
  type UserProfile,
  type AttemptRecord,
  type CustomTestRecord,
  type SkillId,
} from './firebase';
import {
  READING_TESTS,
  LISTENING_TESTS,
  WRITING_PROMPTS,
  SPEAKING_TESTS,
  SKILL_META,
  evaluateWritingRubric,
  evaluateSpeakingRubric,
  type WritingPrompt,
  type WritingRubricResult,
  type SpeakingRubricResult,
} from './workspaceData';
import {
  EXAM_CONFIGS,
  EXAM_ORDER,
  buildNativeObjectiveScore,
  buildNativeRubricScore,
  classifyAttempt,
  computeExamForecast,
  getStoredFocusExam,
  isValidExamId,
  saveExamGoalLocal,
  setStoredFocusExam,
  type ExamId,
} from './examScoring';
import {
  createExaminer3DController,
  type AvatarStatus,
} from './examiner3d';
import {
  EXAMINER_SETTINGS_EVENT,
  getExaminerSettings,
} from './examinerSettings';
import {
  createSpeakingStageEngine,
  type StageRecorderController,
} from './speakingEngine';
import {
  enhanceIeaflSelects,
  closeAllIeaflDropdowns,
} from './ieaflSelect';

export type WorkspaceTab = 'reading' | 'listening' | 'writing' | 'speaking' | 'progress' | 'admin';

export interface WorkspaceMountOptions {
  exam?: string;
  section?: string;
  test?: string;
}

export interface CloudSnapshot {
  authReady: boolean;
  user: User | null;
  isAdmin: boolean;
  profile: UserProfile | null;
  attempts: AttemptRecord[];
  testBank: CustomTestRecord[];
  authError: string | null;
}

interface WorkspaceController {
  mount: (container: HTMLElement, initialTab?: string, opts?: WorkspaceMountOptions) => void;
  unmount: () => void;
  notifyCloudUpdate: (snap: CloudSnapshot) => void;
  getTab: () => WorkspaceTab;
}

function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function fmtDateShort(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function googleMarkSvg(): string {
  return `<svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" style="flex-shrink:0;">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
  </svg>`;
}

function pixelIcon(kind: WorkspaceTab): string {
  const colorMap: Record<WorkspaceTab, string> = {
    reading: '#D873B3',
    listening: '#2BA676',
    writing: '#A98BF7',
    speaking: '#2370E8',
    progress: '#22C98A',
    admin: '#FF5A5A',
  };
  const maps: Record<WorkspaceTab, string[]> = {
    reading: ['11111011111','12221012221','12121012121','12221012221','12121012121','12221012221','12121012121','12221012221','11111111111','00001210000','00001110000'],
    listening: ['00011111000','00122222100','01210001210','12100000121','12100000121','11100000111','12100000121','12100000121','12100000121','01100000110','00000000000'],
    writing: ['00000001110','00000012211','00000122121','00001221210','00012212100','00122121000','01221210000','01212100000','01121000000','01110000000','11111111111'],
    speaking: ['00011111000','00122222100','00121212100','00122222100','00122222100','00011111000','01000100010','00111111100','00000100000','00011111000','00000000000'],
    progress: ['00000000111','00000000121','00000111121','00000121121','00111121121','00121121121','00121121121','11121121121','12121121121','12121121121','11111111111'],
    admin: ['11111111111','12222222221','11111111111','12100000121','12222222221','11111111111','12100000121','12222222221','11111111111','00011111000','00111111100'],
  };
  let rects = '';
  const rows = maps[kind];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '0') continue;
      const fill = ch === '1' ? '#0A0A0A' : colorMap[kind];
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    }
  }
  return `<svg width="16" height="16" viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true" style="display:block;flex-shrink:0;">${rects}</svg>`;
}

function playBeep(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 660;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch {
    // Ignore audio context block
  }
}

export function createWorkspaceController(
  getCloud: () => CloudSnapshot,
  onSyncGoalsSuccess: (profile: UserProfile) => void
): WorkspaceController {
  let rootEl: HTMLElement | null = null;
  let activeTab: WorkspaceTab = 'reading';
  let progressFocusExam: ExamId = getStoredFocusExam();
  let progressShowAllExams = false;
  let statusNotice = '';
  let statusKind: 'ok' | 'err' | '' = '';
  let authBusy = false;

  // Reading Player State
  let readingTestIdx = 0;
  let readingAnswers: Record<string, string> = {};
  let readingFlags: Record<string, boolean> = {};
  let readingCrossed: Record<string, boolean> = {};
  let readingActiveQ = 1;
  let readingSubmitted = false;
  let readingTimeLeft = READING_TESTS[0].durationSec;
  let readingRunning = false;
  let readingTimerId: number | null = null;
  let readingHighlightColor: 'yellow' | 'pink' | 'mint' = 'yellow';
  let readingSavedCloud = false;

  // Listening Player State
  let listeningTestIdx = 0;
  let listeningAnswers: Record<string, string> = {};
  let listeningSubmitted = false;
  let listeningPlaying = false;
  let listeningCueIdx = -1;
  let listeningPlayCount = 0;
  let listeningExamLock = true;
  let listeningRate = 1.0;
  let listeningSavedCloud = false;

  // Writing Studio State
  let writingPromptId = WRITING_PROMPTS[0].id;
  let writingDrafts: Record<string, string> = {};
  let writingTimeLeft = WRITING_PROMPTS[0].durationSec;
  let writingRunning = false;
  let writingTimerId: number | null = null;
  let writingResult: WritingRubricResult | null = null;
  let writingSavedCloud = false;

  // Speaking Examiner State (3D-Stage-First Game-Level Engine: Pre-Generated Gemini 3.8 TTS + Uninterrupted Recorder + Time-Freeze Pause)
  type SpeakingStagePhase =
    | 'idle'
    | 'examiner_speaking'
    | 'prep'
    | 'candidate_speaking'
    | 'stage_clear'
    | 'scoring'
    | 'complete';
  type StageProgressState = 'locked' | 'active' | 'transcribing' | 'cleared';
  type SpeakingPreloadState = 'idle' | 'loading' | 'ready';

  const PART2_START_CUE = 'Your preparation time is up. Please begin speaking now.';
  const EXAMINER_CHECKIN_LINES = [
    "Hey, are you there? Take your time, or we can pause the exam whenever you need.",
    "Hello, are you still with me? Feel free to start speaking, or let me pause the timer for a moment.",
    "Just checking in — I didn't hear anything yet. Would you like to pause for a quick break?",
    "Are you still there? No rush at all — begin whenever you're ready, or press pause if you need a minute.",
  ];

  let speakingTestIdx = 0;
  let speakingTurnIdx = 0;
  function getActiveSpeakingTest() {
    return SPEAKING_TESTS[speakingTestIdx] || SPEAKING_TESTS[0];
  }
  let speakingPhase: SpeakingStagePhase = 'idle';
  let speakingPaused = false;
  let speakingPauseReason = '';
  let speakingPauseOfferVisible = false;
  let speakingCheckInBusy = false;
  let speakingCheckInCount = 0;
  let speakingLastCheckInIdx = -1;
  let speakingTimeLeft = SPEAKING_TESTS[0].turns[0].speakSec;
  let speakingTimerId: number | null = null;
  let speakingClockToken = 0;
  let speakingClockOnZero: (() => void) | null = null;
  let speakingTransitionTimerId: number | null = null;
  let speakingTransitionRemainingMs = 0;
  let speakingTransitionStartedAt = 0;
  let speakingTransitionCallback: (() => void) | null = null;
  let speakingSessionToken = 0;
  let speakingResponses: Record<number, string> = {};
  let speakingStageStates: Record<number, StageProgressState> = {};
  let speakingStagePromises: Record<number, Promise<void>> = {};
  let speakingNotes = '';
  let speakingResult: SpeakingRubricResult | null = null;
  let speakingSavedCloud = false;
  let speakingTranscriptOpen = false;
  let speakingSpeechHeard = false;
  let activeStageRecorder: StageRecorderController | null = null;
  let speakingMicMuted = false;

  // Behind-the-scenes Preload State (3D model + pre-generated Gemini TTS clips)
  let speakingPreloadState: SpeakingPreloadState = 'idle';
  let speakingPreloadKey = '';
  let speakingPreloadAudioDone = 0;
  let speakingPreloadAudioTotal = 0;
  let speakingPreloadAudioLabel = '';
  let speakingPreloadAudioFailed = 0;
  let speakingPreloadAbort: AbortController | null = null;

  const speakingEngine = createSpeakingStageEngine();
  const examiner3d = createExaminer3DController();
  const examiner3dHost = document.createElement('div');
  examiner3dHost.className = 'ws-3d-canvas-host';
  let avatarStatus: AvatarStatus = examiner3d.getStatus();

  function playStageClearChime(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.055, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.17);
      });
    } catch {
      // ignore blocked audio context
    }
  }

  function getSpeakingPreloadClips(): Array<{ label: string; text: string }> {
    const activeTest = getActiveSpeakingTest();
    const clips: Array<{ label: string; text: string }> = activeTest.turns.map((t, idx) => ({
      label: `Stage ${String(idx + 1).padStart(2, '0')} · ${t.label}`,
      text: t.prompt,
    }));
    if (activeTest.turns.some((t) => Boolean(t.prepSec))) {
      clips.push({
        label: 'Part 2 · Start Speaking Cue',
        text: PART2_START_CUE,
      });
    }
    EXAMINER_CHECKIN_LINES.forEach((line, idx) => {
      clips.push({
        label: `Examiner Check-In ${String(idx + 1).padStart(2, '0')}`,
        text: line,
      });
    });
    return clips;
  }

  function pickExaminerCheckInLine(): string {
    const total = EXAMINER_CHECKIN_LINES.length;
    let idx = Math.floor(Math.random() * total);
    if (total > 1 && idx === speakingLastCheckInIdx) {
      idx = (idx + 1) % total;
    }
    speakingLastCheckInIdx = idx;
    return EXAMINER_CHECKIN_LINES[idx];
  }

  function isSpeakingPreloadComplete(): boolean {
    return speakingPreloadState === 'ready' && avatarStatus.state !== 'loading';
  }

  function updatePreloadOverlayDom(): void {
    if (activeTab !== 'speaking') return;
    const overlay = document.getElementById('ws-3d-preload-overlay');
    if (!overlay) return;

    const modelDone = avatarStatus.state !== 'loading';
    const modelPct =
      avatarStatus.state === 'ready'
        ? 100
        : avatarStatus.state === 'error'
          ? 100
          : Math.max(5, Math.min(99, avatarStatus.progress ?? 10));

    const audioTotal = Math.max(1, speakingPreloadAudioTotal);
    const audioPct =
      speakingPreloadState === 'ready'
        ? 100
        : Math.round((speakingPreloadAudioDone / audioTotal) * 100);
    const audioDone = speakingPreloadState === 'ready';
    const allReady = modelDone && audioDone;

    const titleEl = document.getElementById('ws-preload-title');
    const subEl = document.getElementById('ws-preload-sub');
    const modelStateEl = document.getElementById('ws-preload-model-state');
    const modelFillEl = document.getElementById('ws-preload-model-fill');
    const audioStateEl = document.getElementById('ws-preload-audio-state');
    const audioFillEl = document.getElementById('ws-preload-audio-fill');
    const startWrapEl = document.getElementById('ws-preload-start-wrap');

    if (titleEl) {
      titleEl.textContent = allReady ? 'Speaking Room Ready' : 'Preparing Speaking Room…';
    }
    if (subEl) {
      subEl.textContent = allReady
        ? '3D examiner and all voice prompts are cached for zero-delay transitions.'
        : 'Loading 3D examiner model and pre-generating examiner voices behind the scenes.';
    }
    if (modelStateEl) {
      if (avatarStatus.state === 'ready') {
        modelStateEl.textContent = `Ready · ${avatarStatus.label} (${avatarStatus.format})`;
      } else if (avatarStatus.state === 'error') {
        modelStateEl.textContent = avatarStatus.error || 'Avatar fallback active';
      } else {
        modelStateEl.textContent = `Loading ${avatarStatus.label}… ${modelPct}%`;
      }
    }
    if (modelFillEl) {
      modelFillEl.style.width = `${modelPct}%`;
      modelFillEl.classList.toggle('is-done', modelDone);
    }

    const prefs = getExaminerSettings();
    if (audioStateEl) {
      if (audioDone) {
        audioStateEl.textContent =
          speakingPreloadAudioFailed > 0
            ? `${speakingPreloadAudioDone}/${speakingPreloadAudioTotal} clips cached (${speakingPreloadAudioFailed} fallback)`
            : `All ${speakingPreloadAudioTotal} audio clips ready · ${prefs.voiceName}`;
      } else {
        audioStateEl.textContent = `${speakingPreloadAudioDone}/${speakingPreloadAudioTotal} · ${speakingPreloadAudioLabel || 'Synthesizing voice…'}`;
      }
    }
    if (audioFillEl) {
      audioFillEl.style.width = `${audioPct}%`;
      audioFillEl.classList.toggle('is-done', audioDone);
    }

    if (startWrapEl) {
      startWrapEl.style.display = allReady ? 'flex' : 'none';
    }
    if (rootEl && speakingPhase === 'idle') {
      rootEl.querySelectorAll<HTMLButtonElement>('[data-speak-jump]').forEach((btn) => {
        btn.disabled = !allReady;
      });
    }
  }

  function cancelSpeakingPreload(): void {
    if (speakingPreloadAbort) {
      speakingPreloadAbort.abort();
      speakingPreloadAbort = null;
    }
    if (speakingPreloadState === 'loading') {
      speakingPreloadState = 'idle';
      speakingPreloadKey = '';
    }
  }

  function ensureSpeakingPreload(force = false): void {
    const snap = getCloud();
    if (!snap.authReady || !snap.user || activeTab !== 'speaking') return;

    const activeTest = getActiveSpeakingTest();
    const prefs = getExaminerSettings();
    const examMode = activeTest.examMode || 'ielts';
    const nextKey = `${activeTest.id}|${prefs.voiceName}|${examMode}`;

    if (!force && speakingPreloadKey === nextKey && (speakingPreloadState === 'loading' || speakingPreloadState === 'ready')) {
      updatePreloadOverlayDom();
      return;
    }

    cancelSpeakingPreload();
    const clips = getSpeakingPreloadClips();
    const abortCtrl = new AbortController();
    speakingPreloadAbort = abortCtrl;
    speakingPreloadKey = nextKey;
    speakingPreloadState = 'loading';
    speakingPreloadAudioDone = 0;
    speakingPreloadAudioTotal = clips.length;
    speakingPreloadAudioLabel = clips[0]?.label || 'Initializing…';
    speakingPreloadAudioFailed = 0;
    updatePreloadOverlayDom();

    void speakingEngine
      .pregenerateAllClips(
        clips,
        prefs.voiceName,
        examMode,
        (info) => {
          if (abortCtrl.signal.aborted) return;
          speakingPreloadAudioDone = info.done;
          speakingPreloadAudioTotal = info.total;
          speakingPreloadAudioLabel = info.currentLabel;
          speakingPreloadAudioFailed = info.failedCount;
          updatePreloadOverlayDom();
        },
        abortCtrl.signal
      )
      .then((res) => {
        if (abortCtrl.signal.aborted) return;
        speakingPreloadAudioDone = res.done;
        speakingPreloadAudioTotal = res.total;
        speakingPreloadAudioFailed = res.failedCount;
        speakingPreloadState = 'ready';
        if (speakingPreloadAbort === abortCtrl) {
          speakingPreloadAbort = null;
        }
        updatePreloadOverlayDom();
      });
  }

  examiner3d.onStatusChange((next) => {
    avatarStatus = next;
    if (activeTab !== 'speaking') return;
    updatePreloadOverlayDom();
  });

  function onExaminerSettingsUpdated(): void {
    if (activeTab === 'speaking') {
      void examiner3d.applySavedSettings();
      if (speakingPhase === 'idle') {
        ensureSpeakingPreload(false);
      }
    }
  }

  // Progress & Admin form status
  let savingAttempt = false;
  let savingGoals = false;
  let adminBusy = false;

  function stopSpeakingClock(clearCallbacks = true): void {
    if (speakingTimerId !== null) {
      window.clearInterval(speakingTimerId);
      speakingTimerId = null;
    }
    if (speakingTransitionTimerId !== null) {
      window.clearTimeout(speakingTransitionTimerId);
      speakingTransitionTimerId = null;
    }
    if (clearCallbacks) {
      speakingClockOnZero = null;
      speakingTransitionCallback = null;
      speakingTransitionRemainingMs = 0;
    }
  }

  function abortActiveSpeakingRun(releaseMic = false): void {
    speakingSessionToken++;
    speakingPaused = false;
    speakingPauseReason = '';
    speakingPauseOfferVisible = false;
    speakingCheckInBusy = false;
    speakingCheckInCount = 0;
    stopSpeakingClock(true);
    speakingEngine.setExaminerPaused(false);
    speakingEngine.stopExaminerPlayback();
    if (activeStageRecorder) {
      const rec = activeStageRecorder;
      activeStageRecorder = null;
      void rec.stop();
    }
    if (releaseMic) {
      speakingEngine.releaseMicrophone();
    }
    speakingMicMuted = false;
    speakingSpeechHeard = false;
    examiner3d.setPaused(false);
    examiner3d.setAudioLevels(0, 0);
    examiner3d.setMood('idle');
  }

  function resetSpeakingExamState(releaseMic = false): void {
    abortActiveSpeakingRun(releaseMic);
    const activeTest = getActiveSpeakingTest();
    speakingTurnIdx = 0;
    speakingPhase = 'idle';
    speakingTimeLeft = activeTest.turns[0]?.speakSec ?? 45;
    speakingResponses = {};
    speakingStageStates = {};
    speakingStagePromises = {};
    speakingNotes = '';
    speakingResult = null;
    speakingSavedCloud = false;
    speakingTranscriptOpen = false;
  }

  function clearAllTimers(): void {
    if (readingTimerId !== null) {
      window.clearInterval(readingTimerId);
      readingTimerId = null;
    }
    if (writingTimerId !== null) {
      window.clearInterval(writingTimerId);
      writingTimerId = null;
    }
    readingRunning = false;
    writingRunning = false;
    stopListeningPlayback();
    cancelSpeakingPreload();
    abortActiveSpeakingRun(true);
    examiner3d.unmount();
  }

  function stopListeningPlayback(): void {
    listeningPlaying = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  function setNotice(msg: string, kind: 'ok' | 'err' = 'ok'): void {
    statusNotice = msg;
    statusKind = kind;
  }

  async function handleGoogleLogin(): Promise<void> {
    if (authBusy) return;
    authBusy = true;
    statusNotice = '';
    render();
    try {
      await signInWithGoogle();
      setNotice('Signed in with Google. Your IELTS attempts and band goals now sync to Firebase.', 'ok');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      if (msg.includes('popup-closed-by-user')) {
        setNotice('Google sign-in popup was closed before completing authentication.', 'err');
      } else if (msg.includes('popup-blocked')) {
        setNotice('Browser blocked the Google sign-in popup. Please allow popups for this site and try again.', 'err');
      } else {
        setNotice(`Google Sign-In error: ${msg}`, 'err');
      }
    } finally {
      authBusy = false;
      render();
    }
  }

  async function handleSignOut(): Promise<void> {
    if (authBusy) return;
    authBusy = true;
    render();
    try {
      await signOutUser();
      setNotice('Signed out cleanly. Sign back in with Google anytime to resume cloud sync.', 'ok');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Sign-out failed.', 'err');
    } finally {
      authBusy = false;
      render();
    }
  }

  async function persistAttemptToCloud(payload: {
    skill: SkillId;
    testId: string;
    testTitle: string;
    band: number;
    scoreText: string;
    durationSec: number;
    summary: string;
  }): Promise<boolean> {
    const snap = getCloud();
    if (!snap.user) {
      setNotice('Scored locally. Sign in with Google above to save this attempt to your Firebase profile.', 'ok');
      return false;
    }
    savingAttempt = true;
    render();
    try {
      await saveAttempt(snap.user.uid, payload);
      setNotice(`Saved Band ${payload.band.toFixed(1)} (${payload.testTitle}) to your Firebase attempt history.`, 'ok');
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not save attempt to Firestore.', 'err');
      return false;
    } finally {
      savingAttempt = false;
      render();
    }
  }

  function renderAuthBar(snap: CloudSnapshot): string {
    if (!snap.authReady) {
      return `
        <div class="ws-auth-bar">
          <div class="ws-auth-left">
            <span class="t-micro">Checking Firebase Google session…</span>
          </div>
        </div>
      `;
    }
    if (snap.user) {
      const name = snap.profile?.displayName || snap.user.displayName || 'IELTS Learner';
      const email = snap.user.email || '';
      const photo = snap.user.photoURL || '';
      const targetBand = snap.profile?.targetBand ?? 7.5;
      return `
        <div class="ws-auth-bar is-signed-in">
          <div class="ws-auth-left">
            ${
              photo
                ? `<img class="ws-avatar" src="${esc(photo)}" alt="${esc(name)}" referrerpolicy="no-referrer"/>`
                : `<span class="ws-avatar-fallback t-micro fw-600">${esc(name.slice(0, 2).toUpperCase())}</span>`
            }
            <div>
              <div class="t-small fw-600">${esc(name)}${snap.isAdmin ? ' · Admin' : ''}</div>
              <div class="t-micro tnum">${esc(email)} · Goal Band ${targetBand.toFixed(1)} · ${snap.attempts.length} saved attempt${snap.attempts.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div class="ws-auth-right">
            <button type="button" class="chip-toggle t-micro" id="ws-signout-btn" ${authBusy ? 'disabled' : ''}>(Sign out)</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="ws-auth-bar">
        <div class="ws-auth-left">
          <div>
            <div class="t-small fw-600">Google Sign-In Required · Private Mock Exam Sandbox</div>
            <div class="t-micro">Sign in exclusively with Google via Firebase to unlock Reading, Listening, Writing, and 3D Speaking mock exams before uploading official materials.</div>
          </div>
        </div>
        <div class="ws-auth-right">
          <button type="button" class="ws-google-btn t-small" id="ws-google-login-btn" ${authBusy ? 'disabled' : ''}>
            ${googleMarkSvg()}
            <span>${authBusy ? 'Opening Google…' : 'Continue with Google'}</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderTabStrip(snap: CloudSnapshot): string {
    const tabs: Array<{ id: WorkspaceTab; label: string; route: string }> = [
      { id: 'reading', label: 'Reading', route: 'app/reading' },
      { id: 'listening', label: 'Listening', route: 'app/listening' },
      { id: 'writing', label: 'Writing', route: 'app/writing' },
      { id: 'speaking', label: 'Speaking', route: 'app/speaking' },
      { id: 'progress', label: 'Progress & Results', route: 'app/progress' },
      { id: 'admin', label: 'Test Bank Admin', route: 'app/admin' },
    ];
    return `
      <div class="ws-tabs" role="tablist" aria-label="Workspace tools">
        ${tabs
          .map((t) => {
            const active = activeTab === t.id;
            const badge =
              t.id === 'progress' && snap.user ? ` (${snap.attempts.length})` : '';
            return `
              <button type="button" class="ws-tab-btn t-small" role="tab" aria-selected="${active ? 'true' : 'false'}" data-ws-tab="${t.id}">
                ${pixelIcon(t.id)}
                <span>${esc(t.label)}${esc(badge)}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    `;
  }

  // --- TAB 1: READING SPLIT-PANE PLAYER ---
  function renderReadingTab(snap: CloudSnapshot): string {
    const test = READING_TESTS[readingTestIdx] || READING_TESTS[0];
    const totalQ = test.questions.length;
    const answeredCount = test.questions.filter((q) => (readingAnswers[q.id] || '').trim().length > 0).length;
    const flaggedCount = test.questions.filter((q) => readingFlags[q.id]).length;

    let correctCount = 0;
    if (readingSubmitted) {
      test.questions.forEach((q) => {
        const userAns = (readingAnswers[q.id] || '').trim().toLowerCase();
        if (userAns === q.answer.trim().toLowerCase()) correctCount++;
      });
    }
    const nativeReadingScore = readingSubmitted
      ? buildNativeObjectiveScore(test.examId, test.sectionKey, correctCount, totalQ)
      : null;

    return `
      <div class="ws-toolbar">
        <div class="ws-toolbar-group">
          <label class="t-micro" for="ws-reading-select">Exam &amp; Section Bank</label>
          <select id="ws-reading-select" class="text-input ws-select t-small">
            ${READING_TESTS.map((t, i) => `<option value="${i}" ${i === readingTestIdx ? 'selected' : ''}>${esc(t.source)} — ${esc(t.title)}</option>`).join('')}
          </select>
        </div>
        <div class="ws-toolbar-group">
          <span class="ws-clock t-lead tnum" id="ws-reading-clock">${fmtClock(readingTimeLeft)}</span>
          <button type="button" class="chip-toggle t-micro" id="ws-reading-timer-btn">${readingRunning ? '(Pause)' : '(Start clock)'}</button>
          <button type="button" class="chip-toggle t-micro" id="ws-reading-reset-btn">(Reset)</button>
        </div>
        <div class="ws-toolbar-group">
          <span class="t-micro">Highlighter:</span>
          <button type="button" class="ws-hl-swatch hl-yellow" data-hl-color="yellow" aria-pressed="${readingHighlightColor === 'yellow' ? 'true' : 'false'}" title="Yellow highlight">Y</button>
          <button type="button" class="ws-hl-swatch hl-pink" data-hl-color="pink" aria-pressed="${readingHighlightColor === 'pink' ? 'true' : 'false'}" title="Pink highlight">P</button>
          <button type="button" class="ws-hl-swatch hl-mint" data-hl-color="mint" aria-pressed="${readingHighlightColor === 'mint' ? 'true' : 'false'}" title="Mint highlight">M</button>
          <button type="button" class="chip-toggle t-micro" id="ws-reading-hl-apply">(Highlight selection)</button>
          <button type="button" class="chip-toggle t-micro" id="ws-reading-hl-clear">(Clear marks)</button>
        </div>
      </div>

      ${
        readingSubmitted && nativeReadingScore
          ? `
        <div class="ws-result-banner">
          <div>
            <p class="t-micro">(Solution Mode Active · ${esc(nativeReadingScore.sectionBadge)})</p>
            <h2 class="t-lead tnum">${esc(nativeReadingScore.headline)}</h2>
            <p class="t-small" style="margin-top:4px;">Evidence paragraphs are pinned below each question. ${readingSavedCloud ? 'Saved to Firebase Firestore.' : snap.user ? 'Saving to Firebase…' : 'Sign in with Google to save this attempt.'}</p>
          </div>
          <div class="ws-toolbar-group">
            ${!readingSavedCloud && !snap.user ? `<button type="button" class="ws-google-btn t-micro" id="ws-reading-save-google">${googleMarkSvg()}<span>Sign in with Google to save</span></button>` : ''}
            <button type="button" class="chip-toggle t-micro" id="ws-reading-retry-btn">(Retry passage)</button>
          </div>
        </div>
      `
          : ''
      }

      <div class="ws-reading-split">
        <article class="ws-pane ws-passage-pane" id="ws-passage-pane" aria-label="Reading passage">
          <p class="t-micro">${esc(test.source)}</p>
          <h2 class="t-h2" style="margin-top:6px;">${esc(test.title)}</h2>
          <p class="t-micro" style="margin-top:6px;">Select any phrase and press "Highlight selection" (or Alt+H) to annotate evidence.</p>
          <div class="ws-passage-body" id="ws-passage-body">
            ${test.paragraphs
              .map((p) => {
                const isEvidence =
                  readingSubmitted &&
                  test.questions.some(
                    (q) => q.num === readingActiveQ && q.evidenceParagraph === p.label
                  );
                return `
                  <div class="ws-para${isEvidence ? ' is-evidence' : ''}" data-para="${esc(p.label)}">
                    <span class="ws-para-tag t-micro fw-600">${esc(p.label)}</span>
                    <p class="t-body">${esc(p.text)}</p>
                  </div>
                `;
              })
              .join('')}
          </div>
        </article>

        <section class="ws-pane ws-questions-pane" aria-label="Reading questions">
          <div class="ws-q-head">
            <span class="t-micro tnum">${answeredCount}/${totalQ} answered · ${flaggedCount} flagged · Alt+N / Alt+P to navigate</span>
            ${
              !readingSubmitted
                ? `<button type="button" class="btn-primary btn-sm t-small" id="ws-reading-submit-btn" ${savingAttempt ? 'disabled' : ''}><span>Submit &amp; Score</span></button>`
                : ''
            }
          </div>

          <div class="ws-questions-list">
            ${test.questions
              .map((q) => {
                const val = readingAnswers[q.id] || '';
                const flagged = Boolean(readingFlags[q.id]);
                const isCurrent = readingActiveQ === q.num;
                const isCorrect =
                  readingSubmitted && val.trim().toLowerCase() === q.answer.trim().toLowerCase();
                return `
                  <div class="ws-q-card${isCurrent ? ' is-current' : ''}${readingSubmitted ? (isCorrect ? ' is-correct' : ' is-wrong') : ''}" id="ws-q-${q.num}" data-q-num="${q.num}">
                    <div class="ws-q-top">
                      <span class="t-micro fw-600 tnum">Q${String(q.num).padStart(2, '0')} · ${q.type.toUpperCase()}</span>
                      <button type="button" class="chip-toggle t-micro" data-flag-q="${esc(q.id)}" aria-pressed="${flagged ? 'true' : 'false'}">
                        ${flagged ? '(Flagged)' : '(Flag)'}
                      </button>
                    </div>
                    <p class="t-small fw-600" style="margin-top:8px;">${esc(q.prompt)}</p>
                    ${
                      q.options
                        ? `<div class="ws-options">
                            ${q.options
                              .map((opt, oi) => {
                                const crossKey = `${q.id}:${oi}`;
                                const crossed = Boolean(readingCrossed[crossKey]);
                                const checked = val === opt;
                                return `
                                  <div class="ws-opt-row${crossed ? ' is-crossed' : ''}">
                                    <label class="ws-opt-label t-small">
                                      <input type="radio" name="rq-${esc(q.id)}" value="${esc(opt)}" ${checked ? 'checked' : ''} ${readingSubmitted ? 'disabled' : ''} data-rq="${esc(q.id)}"/>
                                      <span>${esc(opt)}</span>
                                    </label>
                                    <button type="button" class="ws-strike-btn t-micro" data-cross="${esc(crossKey)}" aria-pressed="${crossed ? 'true' : 'false'}" title="Cross out option">✕</button>
                                  </div>
                                `;
                              })
                              .join('')}
                          </div>`
                        : `<div style="margin-top:10px;">
                            <input type="text" class="text-input t-small" data-rq-text="${esc(q.id)}" value="${esc(val)}" placeholder="Type ONE WORD from passage…" ${readingSubmitted ? 'disabled' : ''}/>
                          </div>`
                    }
                    ${
                      readingSubmitted
                        ? `<div class="ws-solution-box t-micro">
                            <strong>${isCorrect ? 'Correct' : 'Incorrect'}</strong> · Key: <span class="fw-600">${esc(q.answer)}</span> · Evidence: Paragraph ${esc(q.evidenceParagraph)}<br/>
                            ${esc(q.explanation)}
                          </div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
      </div>

      <div class="ws-palette" aria-label="Question Palette">
        <span class="t-micro fw-600">Question Palette:</span>
        <div class="ws-palette-nums">
          ${test.questions
            .map((q) => {
              const answered = (readingAnswers[q.id] || '').trim().length > 0;
              const flagged = Boolean(readingFlags[q.id]);
              const isCurrent = readingActiveQ === q.num;
              const correct =
                readingSubmitted &&
                (readingAnswers[q.id] || '').trim().toLowerCase() === q.answer.trim().toLowerCase();
              return `<button type="button" class="ws-pal-btn t-micro tnum${answered ? ' is-answered' : ''}${flagged ? ' is-flagged' : ''}${isCurrent ? ' is-current' : ''}${readingSubmitted ? (correct ? ' is-correct' : ' is-wrong') : ''}" data-jump-q="${q.num}">${q.num}${flagged ? '*' : ''}</button>`;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // --- TAB 2: LISTENING SECTIONED AUDIO PLAYER ---
  function renderListeningTab(snap: CloudSnapshot): string {
    const test = LISTENING_TESTS[listeningTestIdx] || LISTENING_TESTS[0];
    const totalQ = test.questions.length;
    let correctCount = 0;
    if (listeningSubmitted) {
      test.questions.forEach((q) => {
        const u = (listeningAnswers[q.id] || '').trim().toLowerCase();
        if (q.answers.includes(u)) correctCount++;
      });
    }
    const nativeListeningScore = listeningSubmitted
      ? buildNativeObjectiveScore(test.examId, test.sectionKey, correctCount, totalQ)
      : null;
    const progressPct =
      listeningCueIdx < 0
        ? 0
        : Math.min(100, Math.round(((listeningCueIdx + 1) / test.cues.length) * 100));
    const lockBlocked = listeningExamLock && !listeningSubmitted && listeningPlayCount >= 1 && !listeningPlaying;

    return `
      <div class="ws-toolbar">
        <div class="ws-toolbar-group">
          <label class="t-micro" for="ws-listening-select">Listening Section</label>
          <select id="ws-listening-select" class="text-input ws-select t-small">
            ${LISTENING_TESTS.map((t, i) => `<option value="${i}" ${i === listeningTestIdx ? 'selected' : ''}>${esc(t.source)} — ${esc(t.title)}</option>`).join('')}
          </select>
        </div>
        <div class="ws-toolbar-group">
          <button type="button" class="chip-toggle t-micro" id="ws-listen-lock-btn" aria-pressed="${listeningExamLock ? 'true' : 'false'}">
            (${listeningExamLock ? 'Exam Lock: 1 Play Only' : 'Practice Mode: Unlimited Replay'})
          </button>
          <button type="button" class="chip-toggle t-micro" id="ws-listen-speed-btn">(Speed: ${listeningRate.toFixed(1)}×)</button>
        </div>
      </div>

      <div class="ws-audio-deck">
        <div class="ws-audio-top">
          <div>
            <p class="t-micro">${esc(test.partLabel)} · ${esc(test.source)}</p>
            <h2 class="t-lead" style="margin-top:4px;">${esc(test.title)}</h2>
            <p class="t-micro" style="margin-top:4px;">${esc(test.instructions)}</p>
          </div>
          <div class="ws-toolbar-group">
            <button type="button" class="btn-primary btn-sm t-small" id="ws-listen-play-btn" ${lockBlocked ? 'disabled' : ''}>
              <span>${listeningPlaying ? 'Stop Audio' : lockBlocked ? 'Played Once (Locked)' : 'Play Exam Audio'}</span>
            </button>
            ${
              !listeningSubmitted
                ? `<button type="button" class="chip-toggle t-small" id="ws-listen-submit-btn" ${savingAttempt ? 'disabled' : ''}>(Submit &amp; Unlock Transcript)</button>`
                : `<button type="button" class="chip-toggle t-small" id="ws-listen-retry-btn">(Retry Section)</button>`
            }
          </div>
        </div>
        <div class="ws-audio-bar-wrap">
          <div class="ws-audio-bar"><div class="ws-audio-fill" style="transform:scaleX(${(progressPct / 100).toFixed(3)})"></div></div>
          <div class="ws-audio-meta t-micro tnum">
            <span>${listeningPlaying && listeningCueIdx >= 0 ? `Speaking: ${esc(test.cues[listeningCueIdx].speaker)} (Segment ${listeningCueIdx + 1}/${test.cues.length})` : listeningPlayCount > 0 ? `Completed ${listeningPlayCount} playback${listeningPlayCount === 1 ? '' : 's'}` : 'Ready · Audio plays via browser speech synthesis'}</span>
            <span>${progressPct}%</span>
          </div>
        </div>
      </div>

      ${
        listeningSubmitted && nativeListeningScore
          ? `
        <div class="ws-result-banner">
          <div>
            <p class="t-micro">(Solution Review · ${esc(nativeListeningScore.sectionBadge)})</p>
            <h2 class="t-lead tnum">${esc(nativeListeningScore.headline)}</h2>
            <p class="t-small" style="margin-top:4px;">Full audio transcript is now unlocked below with highlighted answer cues. ${listeningSavedCloud ? 'Saved to Firebase Firestore.' : snap.user ? 'Saving…' : 'Sign in with Google to save.'}</p>
          </div>
        </div>
      `
          : ''
      }

      <div class="ws-listening-grid">
        <div class="ws-pane">
          <p class="t-micro fw-600">Questions 1–${totalQ}</p>
          <div class="ws-questions-list" style="margin-top:12px;">
            ${test.questions
              .map((q) => {
                const val = listeningAnswers[q.id] || '';
                const isCorrect =
                  listeningSubmitted && q.answers.includes(val.trim().toLowerCase());
                return `
                  <div class="ws-q-card${listeningSubmitted ? (isCorrect ? ' is-correct' : ' is-wrong') : ''}">
                    <div class="ws-q-top">
                      <span class="t-micro fw-600 tnum">Q${String(q.num).padStart(2, '0')} · ${q.type === 'completion' ? `COMPLETION (${esc(q.wordLimit || 'ONE WORD')})` : 'MULTIPLE CHOICE'}</span>
                    </div>
                    <p class="t-small fw-600" style="margin-top:6px;">${esc(q.prompt)}</p>
                    ${
                      q.options
                        ? `<div class="ws-options">
                            ${q.options
                              .map(
                                (opt) => `
                              <label class="ws-opt-label t-small">
                                <input type="radio" name="lq-${esc(q.id)}" value="${esc(opt)}" ${val === opt ? 'checked' : ''} ${listeningSubmitted ? 'disabled' : ''} data-lq="${esc(q.id)}"/>
                                <span>${esc(opt)}</span>
                              </label>
                            `
                              )
                              .join('')}
                          </div>`
                        : `<div style="margin-top:8px;">
                            <input type="text" class="text-input t-small" data-lq-text="${esc(q.id)}" value="${esc(val)}" placeholder="Enter answer (${esc(q.wordLimit || 'ONE WORD')})…" ${listeningSubmitted ? 'disabled' : ''}/>
                          </div>`
                    }
                    ${
                      listeningSubmitted
                        ? `<div class="ws-solution-box t-micro">
                            <strong>${isCorrect ? 'Correct' : 'Check spelling / distractor'}</strong> · Accepted key: <span class="fw-600">${esc(q.answers[0])}</span><br/>
                            ${esc(q.explanation)}
                          </div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="ws-pane">
          <p class="t-micro fw-600">Audio Transcript Verification</p>
          ${
            listeningSubmitted
              ? `<div class="ws-transcript-list">
                  ${test.cues
                    .map((c, idx) => {
                      let htmlText = esc(c.text);
                      if (c.highlightPhrase) {
                        const re = new RegExp(`(${c.highlightPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
                        htmlText = htmlText.replace(re, '<mark class="ws-hl-mint">$1</mark>');
                      }
                      return `<div class="ws-cue-row${listeningCueIdx === idx && listeningPlaying ? ' is-live' : ''}">
                        <span class="t-micro fw-600">${esc(c.speaker)}:</span>
                        <span class="t-small">${htmlText}</span>
                      </div>`;
                    })
                    .join('')}
                </div>`
              : `<div class="ws-locked-transcript">
                  <p class="t-small fw-600">Transcript hidden during active Listening attempt.</p>
                  <p class="t-micro" style="margin-top:6px;">Submit your answers to unlock the full synchronized transcript with highlighted distractor corrections and replay controls.</p>
                </div>`
          }
        </div>
      </div>
    `;
  }

  // --- TAB 3: WRITING STUDIO + NATIVE EXAM RUBRIC SCORER ---
  function getAllWritingPrompts(snap: CloudSnapshot): WritingPrompt[] {
    const customWriting: WritingPrompt[] = snap.testBank
      .filter((item) => item.skill === 'writing' && (item.published || snap.isAdmin))
      .map((item) => {
        const srcLower = `${item.source} ${item.title}`.toLowerCase();
        const examId: ExamId = /olympic/.test(srcLower)
          ? 'olympic304'
          : /\bhsg\b/.test(srcLower)
            ? 'hsg'
            : /\bnec\b|hsgqg/.test(srcLower)
              ? 'nec'
              : 'ielts';
        const sectionKey = examId === 'olympic304' ? 'transform' : 'writing';
        return {
          id: item.id,
          examId,
          sectionKey,
          task: 'task2' as const,
          source: `${item.source} (Custom Bank)`,
          title: item.title,
          durationSec: 2400,
          minWords: 250,
          prompt: item.prompt,
        };
      });
    return [...WRITING_PROMPTS, ...customWriting];
  }

  function renderWritingTab(snap: CloudSnapshot): string {
    const allPrompts = getAllWritingPrompts(snap);
    const current = allPrompts.find((p) => p.id === writingPromptId) || allPrompts[0];
    const draft = writingDrafts[current.id] || '';
    const words = draft.trim() ? draft.trim().split(/\s+/).filter(Boolean).length : 0;
    const paragraphs = draft.trim() ? draft.trim().split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
    const meetsFloor = words >= current.minWords;

    const chartSvg = current.tableData
      ? (() => {
          const rows = current.tableData.rows;
          const barW = 24;
          const groupW = 112;
          const W = rows.length * groupW + 64;
          const H = 160;
          const colors = ['#D873B3', '#A98BF7', '#2BA676'];
          let bars = '';
          rows.forEach((r, ri) => {
            const gx = 44 + ri * groupW;
            const vals = [Number(r[1]), Number(r[2]), Number(r[3])];
            vals.forEach((v, vi) => {
              const bh = Math.round((v / 100) * 108);
              const bx = gx + vi * (barW + 4);
              const by = 128 - bh;
              bars += `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${colors[vi]}" stroke="#0A0A0A" stroke-width="1.5"/>`;
              bars += `<text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle" font-size="9" font-weight="600" fill="#0A0A0A">${v}%</text>`;
            });
            bars += `<text x="${gx + 40}" y="148" text-anchor="middle" font-size="10" font-weight="600" fill="#0A0A0A">${esc(String(r[0]))}</text>`;
          });
          return `
            <div class="ws-chart-box">
              <div class="ws-chart-legend t-micro">
                <span><i style="background:#D873B3"></i>2015</span>
                <span><i style="background:#A98BF7"></i>2020</span>
                <span><i style="background:#2BA676"></i>2025</span>
              </div>
              <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;" shape-rendering="crispEdges" role="img" aria-label="${esc(current.tableData.caption)}">
                <line x1="36" y1="128" x2="${W - 12}" y2="128" stroke="#0A0A0A" stroke-width="2"/>
                <line x1="36" y1="20" x2="36" y2="128" stroke="#0A0A0A" stroke-width="2"/>
                ${bars}
              </svg>
            </div>
          `;
        })()
      : '';

    return `
      <div class="ws-toolbar">
        <div class="ws-toolbar-group">
          <label class="t-micro" for="ws-writing-select">Writing Task</label>
          <select id="ws-writing-select" class="text-input ws-select t-small">
            ${allPrompts.map((p) => `<option value="${esc(p.id)}" ${p.id === current.id ? 'selected' : ''}>${esc(p.source)} — ${esc(p.title)}</option>`).join('')}
          </select>
        </div>
        <div class="ws-toolbar-group">
          <span class="ws-clock t-lead tnum" id="ws-writing-clock">${fmtClock(writingTimeLeft)}</span>
          <button type="button" class="chip-toggle t-micro" id="ws-writing-timer-btn">${writingRunning ? '(Pause)' : '(Start clock)'}</button>
          <button type="button" class="chip-toggle t-micro" id="ws-writing-reset-btn">(Reset)</button>
        </div>
      </div>

      <div class="ws-reading-split">
        <article class="ws-pane">
          <p class="t-micro">${esc(current.source)} · ${current.task === 'task1' ? '1/3 Weight · 20 min' : '2/3 Weight · 40 min'}</p>
          <h2 class="t-h2" style="margin-top:6px;">${esc(current.title)}</h2>
          <p class="t-body" style="margin-top:12px;">${esc(current.prompt)}</p>
          ${chartSvg}
          ${
            current.tableData
              ? `
            <table class="data-table" style="margin-top:16px;">
              <caption class="t-micro">${esc(current.tableData.caption)}</caption>
              <thead><tr>${current.tableData.headers.map((h) => `<th class="t-micro">${esc(h)}</th>`).join('')}</tr></thead>
              <tbody>
                ${current.tableData.rows.map((row) => `<tr>${row.map((cell) => `<td class="t-small tnum">${esc(String(cell))}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          `
              : ''
          }
        </article>

        <section class="ws-pane">
          <div class="ws-q-head">
            <span class="t-micro tnum" id="ws-writing-stats">
              <strong style="color:${meetsFloor ? '#1A7A54' : '#0A0A0A'}">${words} / ${current.minWords}+ words</strong> · ${paragraphs} paragraph${paragraphs === 1 ? '' : 's'}
            </span>
            <button type="button" class="btn-primary btn-sm t-small" id="ws-writing-submit-btn" ${savingAttempt ? 'disabled' : ''}><span>Score with Rubric</span></button>
          </div>
          <textarea id="ws-writing-editor" class="ws-textarea t-body" rows="15" placeholder="Write your IELTS response here. Separate paragraphs with a blank line...">${esc(draft)}</textarea>

          ${
            writingResult
              ? (() => {
                  const nativeWriting = buildNativeRubricScore(
                    current.examId,
                    current.sectionKey,
                    writingResult.qualityRatio,
                    writingResult.overall,
                    `${writingResult.words}w`
                  );
                  const isIeltsW = current.examId === 'ielts';
                  const fmtCrit = (bandVal: number) =>
                    isIeltsW ? bandVal.toFixed(1) : `${Math.round((bandVal / 9) * 100)}%`;
                  return `
            <div class="ws-rubric-panel">
              <div class="ws-rubric-head">
                <div>
                  <p class="t-micro">(${esc(nativeWriting.sectionBadge)} Rubric Evaluation)</p>
                  <h3 class="t-lead tnum">${esc(nativeWriting.headline)}</h3>
                </div>
                <span class="t-micro">${writingSavedCloud ? 'Saved to Firebase' : snap.user ? 'Syncing…' : 'Local score only'}</span>
              </div>
              <div class="ws-rubric-grid tnum">
                <div class="ws-rubric-cell"><span class="t-micro">${current.task === 'task1' ? 'Task Fulfillment' : 'Task Response'}</span><strong class="t-lead">${fmtCrit(writingResult.ta)}</strong></div>
                <div class="ws-rubric-cell"><span class="t-micro">Coherence &amp; Cohesion</span><strong class="t-lead">${fmtCrit(writingResult.cc)}</strong></div>
                <div class="ws-rubric-cell"><span class="t-micro">Lexical Resource</span><strong class="t-lead">${fmtCrit(writingResult.lr)}</strong></div>
                <div class="ws-rubric-cell"><span class="t-micro">Grammatical Precision</span><strong class="t-lead">${fmtCrit(writingResult.gra)}</strong></div>
              </div>
              <ul class="access-list t-small" style="margin-top:12px;">
                ${writingResult.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
              </ul>
            </div>
          `;
                })()
              : ''
          }
        </section>
      </div>
    `;
  }

  // --- TAB 4: 3D-STAGE-FIRST SPEAKING STUDIO (GAME-LEVEL STAGES + GEMINI 3.8 TTS + UNINTERRUPTED AUTO-ADVANCE) ---
  function renderSpeakingTab(snap: CloudSnapshot): string {
    const activeTest = getActiveSpeakingTest();
    const turns = activeTest.turns;
    const turn = turns[speakingTurnIdx] || turns[0];
    const nextTurn = turns[speakingTurnIdx + 1] || null;
    const prefs = getExaminerSettings();
    const stageNum = String(speakingTurnIdx + 1).padStart(2, '0');
    const totalStages = String(turns.length).padStart(2, '0');

    const phaseMeta: Record<SpeakingStagePhase, { tag: string; cls: string }> = {
      idle: { tag: `STAGE ${stageNum} / ${totalStages} · READY`, cls: 'is-idle' },
      examiner_speaking: { tag: `STAGE ${stageNum} / ${totalStages} · EXAMINER SPEAKING`, cls: 'is-examiner' },
      prep: { tag: `STAGE ${stageNum} / ${totalStages} · 1:00 CUE CARD PREP`, cls: 'is-prep' },
      candidate_speaking: {
        tag: speakingMicMuted
          ? `STAGE ${stageNum} / ${totalStages} · MIC MUTED`
          : `STAGE ${stageNum} / ${totalStages} · YOUR TURN (UNINTERRUPTED)`,
        cls: speakingMicMuted ? 'is-muted' : 'is-listening',
      },
      stage_clear: { tag: `STAGE ${stageNum} CLEARED`, cls: 'is-clear' },
      scoring: { tag: 'FINALIZING TRANSCRIPTS & BAND SCORE…', cls: 'is-prep' },
      complete: { tag: 'ALL STAGES CLEARED · EXAM COMPLETE', cls: 'is-clear' },
    };

    const currentBadge = speakingPaused
      ? { tag: `STAGE ${stageNum} / ${totalStages} · PAUSED (TIME FROZEN)`, cls: 'is-paused' }
      : phaseMeta[speakingPhase];
    const isRunning = speakingPhase !== 'idle' && speakingPhase !== 'complete';
    const canPause =
      speakingPhase === 'examiner_speaking' ||
      speakingPhase === 'prep' ||
      speakingPhase === 'candidate_speaking' ||
      speakingPhase === 'stage_clear';
    const showCueCard =
      Boolean(turn.cueCardBullets) &&
      (speakingPhase === 'prep' ||
        speakingPhase === 'candidate_speaking' ||
        speakingPhase === 'examiner_speaking');

    const modelDone = avatarStatus.state !== 'loading';
    const modelPct =
      avatarStatus.state === 'ready' || avatarStatus.state === 'error'
        ? 100
        : Math.max(5, Math.min(99, avatarStatus.progress ?? 10));
    const audioTotal = Math.max(1, speakingPreloadAudioTotal || getSpeakingPreloadClips().length);
    const audioDone = speakingPreloadState === 'ready';
    const audioPct = audioDone
      ? 100
      : Math.round((speakingPreloadAudioDone / audioTotal) * 100);
    const preloadAllReady = modelDone && audioDone;

    return `
      <div class="ws-toolbar ws-sp-toolbar">
        <div class="ws-toolbar-group">
          <label class="t-micro" for="ws-speaking-select">Speaking Exam</label>
          <select id="ws-speaking-select" class="text-input ws-select t-small" ${isRunning ? 'disabled' : ''}>
            ${SPEAKING_TESTS.map((t, i) => `<option value="${i}" ${i === speakingTestIdx ? 'selected' : ''}>${esc(t.source)} — ${esc(t.title)}</option>`).join('')}
          </select>
        </div>
        <div class="ws-toolbar-group">
          ${
            isRunning || speakingPhase === 'complete'
              ? `<button type="button" class="chip-toggle t-micro" id="ws-speak-restart-btn">(Restart Exam)</button>`
              : ''
          }
          <a class="chip-toggle t-micro" href="#/profile" id="ws-speak-profile-settings-link">(Examiner &amp; Voice Settings)</a>
        </div>
      </div>

      <div class="ws-stage-rail" role="list" aria-label="Speaking exam stages">
        ${turns
          .map((t, idx) => {
            const st: StageProgressState =
              speakingStageStates[idx] ||
              (idx === speakingTurnIdx && speakingPhase !== 'idle'
                ? 'active'
                : 'locked');
            const isCurrent = idx === speakingTurnIdx;
            const statusGlyph =
              st === 'cleared'
                ? '✓'
                : st === 'transcribing'
                  ? '…'
                  : isCurrent && speakingPhase !== 'idle'
                    ? '●'
                    : String(idx + 1).padStart(2, '0');
            return `
              <button
                type="button"
                class="ws-stage-cell ${isCurrent ? 'is-current' : ''} is-${st}"
                data-speak-jump="${idx}"
                ${speakingPhase === 'scoring' || (speakingPhase === 'idle' && !preloadAllReady) ? 'disabled' : ''}
              >
                <span class="ws-stage-num t-micro tnum">${statusGlyph}</span>
                <span class="ws-stage-meta">
                  <span class="t-micro fw-600">STAGE ${String(idx + 1).padStart(2, '0')} · P${t.part}</span>
                  <span class="ws-stage-sub t-micro">${esc(t.label.replace(/^Part\s*\d+\s*·\s*/i, ''))}</span>
                </span>
              </button>
            `;
          })
          .join('')}
      </div>

      <div class="ws-3d-viewport ws-3d-viewport-cinema" id="ws-3d-viewport" aria-label="3D Speaking Examiner Stage">
        <div class="ws-3d-stage-slot" id="ws-3d-stage-slot"></div>

        <div class="ws-3d-hud-top">
          <div class="ws-3d-badge ${currentBadge.cls} t-micro fw-600" id="ws-3d-badge-text">${esc(currentBadge.tag)}</div>
          <div class="ws-3d-clock-cluster">
            ${
              speakingPhase === 'candidate_speaking'
                ? `<div class="ws-mic-meter" aria-label="Microphone voice level">
                    <span class="ws-mic-dot${speakingMicMuted || speakingPaused ? ' is-muted' : ''}"></span>
                    <div class="ws-mic-meter-track"><div class="ws-mic-meter-fill" id="ws-mic-meter-fill"></div></div>
                  </div>`
                : ''
            }
            <div class="ws-3d-clock t-lead tnum ${speakingPaused ? 'is-paused' : speakingPhase === 'prep' ? 'is-prep' : speakingPhase === 'candidate_speaking' ? 'is-live' : ''}" id="ws-speaking-clock">${fmtClock(speakingTimeLeft)}</div>
          </div>
        </div>

        ${
          speakingPhase === 'idle'
            ? `<div class="ws-3d-preload-overlay" id="ws-3d-preload-overlay" role="status" aria-live="polite">
                <div class="ws-preload-card">
                  <div class="ws-preload-head">
                    <div>
                      <p class="t-micro fw-600" style="color:var(--cobalt);">${esc(activeTest.source)} · ${turns.length} STAGES</p>
                      <h3 class="t-lead" id="ws-preload-title" style="margin-top:4px;">${preloadAllReady ? 'Speaking Room Ready' : 'Preparing Speaking Room…'}</h3>
                      <p class="t-micro" id="ws-preload-sub" style="margin-top:4px;opacity:0.8;">
                        ${
                          preloadAllReady
                            ? '3D examiner and all voice prompts are cached for zero-delay transitions.'
                            : 'Loading 3D examiner model and pre-generating examiner voices behind the scenes.'
                        }
                      </p>
                    </div>
                  </div>

                  <div class="ws-preload-steps">
                    <div class="ws-preload-step">
                      <div class="ws-preload-step-row t-micro">
                        <span class="fw-600">01 · 3D Examiner Model</span>
                        <span class="tnum" id="ws-preload-model-state">
                          ${
                            avatarStatus.state === 'ready'
                              ? `Ready · ${esc(avatarStatus.label)} (${esc(avatarStatus.format)})`
                              : avatarStatus.state === 'error'
                                ? esc(avatarStatus.error || 'Avatar fallback active')
                                : `Loading ${esc(avatarStatus.label)}… ${modelPct}%`
                          }
                        </span>
                      </div>
                      <div class="ws-preload-bar-track">
                        <div class="ws-preload-bar-fill${modelDone ? ' is-done' : ''}" id="ws-preload-model-fill" style="width:${modelPct}%;"></div>
                      </div>
                    </div>

                    <div class="ws-preload-step">
                      <div class="ws-preload-step-row t-micro">
                        <span class="fw-600">02 · Pre-Generating Examiner Audio</span>
                        <span class="tnum" id="ws-preload-audio-state">
                          ${
                            audioDone
                              ? speakingPreloadAudioFailed > 0
                                ? `${speakingPreloadAudioDone}/${audioTotal} clips cached (${speakingPreloadAudioFailed} fallback)`
                                : `All ${audioTotal} audio clips ready · ${esc(prefs.voiceName)}`
                              : `${speakingPreloadAudioDone}/${audioTotal} · ${esc(speakingPreloadAudioLabel || 'Synthesizing voice…')}`
                          }
                        </span>
                      </div>
                      <div class="ws-preload-bar-track">
                        <div class="ws-preload-bar-fill${audioDone ? ' is-done' : ''}" id="ws-preload-audio-fill" style="width:${audioPct}%;"></div>
                      </div>
                    </div>
                  </div>

                  <div class="ws-preload-footer" id="ws-preload-start-wrap" style="display:${preloadAllReady ? 'flex' : 'none'};">
                    <span class="t-micro" style="opacity:0.75;">${prefs.autoAdvance ? `${prefs.silenceDelaySec.toFixed(0)}s silence auto-advance` : 'Manual advance'} · ${esc(prefs.voiceName)}</span>
                    <button type="button" class="btn-primary btn-sm t-small" id="ws-speak-start-exam-btn">
                      <span>Start</span>
                    </button>
                  </div>
                </div>
              </div>`
            : ''
        }

        ${
          showCueCard && turn.cueCardBullets
            ? `<aside class="ws-3d-cue-overlay" aria-label="Part 2 Cue Card">
                <div class="ws-3d-cue-head">
                  <span class="t-micro fw-600">PART 2 CUE CARD</span>
                  <span class="t-micro tnum">${speakingPhase === 'prep' ? '1-MIN PREP' : 'SPEAK 1–2 MIN'}</span>
                </div>
                <ul class="ws-3d-cue-list t-small">
                  ${turn.cueCardBullets.map((b) => `<li>${esc(b)}</li>`).join('')}
                </ul>
                ${
                  speakingPhase === 'prep'
                    ? `<textarea id="ws-speak-notes" class="ws-3d-cue-notes t-micro" rows="3" placeholder="Quick prep notes (optional)..." ${speakingPaused ? 'disabled' : ''}>${esc(speakingNotes)}</textarea>`
                    : speakingNotes.trim()
                      ? `<div class="ws-3d-cue-notes-read t-micro"><strong>Notes:</strong> ${esc(speakingNotes)}</div>`
                      : ''
                }
              </aside>`
            : ''
        }

        ${
          speakingPhase === 'stage_clear'
            ? `<div class="ws-stage-transition-overlay" role="status" aria-live="polite">
                <div class="ws-stage-transition-card">
                  <p class="t-micro fw-600" style="color:var(--sodium);">STAGE ${stageNum} CLEARED ✓</p>
                  <h3 class="t-h2" style="color:#FFFFFF;margin-top:6px;">
                    ${nextTurn ? `Next: Stage ${String(speakingTurnIdx + 2).padStart(2, '0')} · ${esc(nextTurn.label)}` : 'Finalizing Your Band Score'}
                  </h3>
                  <p class="t-small" style="color:rgba(255,255,255,0.82);margin-top:6px;">
                    ${speakingPaused ? 'Time frozen — click Resume whenever you are ready.' : 'Recording saved. Advancing automatically…'}
                  </p>
                  <div class="ws-transition-bar-track"><div class="ws-transition-bar-fill${speakingPaused ? ' is-paused' : ''}"></div></div>
                  <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="btn-primary btn-sm t-micro" id="ws-speak-continue-now-btn" ${speakingPaused ? 'disabled' : ''}><span>Continue Now →</span></button>
                  </div>
                </div>
              </div>`
            : ''
        }

        ${
          speakingPaused
            ? `<div class="ws-pause-overlay" role="dialog" aria-label="Exam paused">
                <div class="ws-pause-card">
                  <p class="t-micro fw-600" style="color:var(--sodium);">TIME FROZEN</p>
                  <h3 class="t-h2" style="color:#FFFFFF;margin-top:4px;">Speaking Exam Paused</h3>
                  <p class="t-micro" style="color:rgba(255,255,255,0.84);margin-top:6px;">
                    ${esc(speakingPauseReason || `Clock (${fmtClock(speakingTimeLeft)}), examiner voice, recording, and 3D motion are frozen in place.`)}
                  </p>
                  <div style="margin-top:14px;display:flex;gap:8px;justify-content:center;">
                    <button type="button" class="btn-primary btn-sm t-small" id="ws-speak-resume-overlay-btn"><span>Resume</span></button>
                  </div>
                </div>
              </div>`
            : ''
        }

        ${
          speakingPhase === 'scoring'
            ? `<div class="ws-stage-transition-overlay" role="status" aria-live="polite">
                <div class="ws-stage-transition-card">
                  <p class="t-micro fw-600" style="color:var(--sodium);">ALL ${totalStages} STAGES RECORDED</p>
                  <h3 class="t-h2" style="color:#FFFFFF;margin-top:6px;">Transcribing &amp; Scoring Interview…</h3>
                  <p class="t-small" style="color:rgba(255,255,255,0.82);margin-top:6px;">Processing every stage with Gemini 3.5 Transcribe before calculating your Band estimate.</p>
                </div>
              </div>`
            : ''
        }

        ${
          speakingPhase !== 'idle' && speakingPhase !== 'scoring'
            ? `<div class="ws-3d-bottom-hud">
                ${
                  speakingPauseOfferVisible && !speakingPaused && speakingPhase === 'candidate_speaking'
                    ? `<div class="ws-pause-offer-card" id="ws-pause-offer-card" role="status" aria-live="polite">
                        <div class="ws-pause-offer-copy">
                          <span class="t-micro fw-600" style="color:var(--cobalt);">EXAMINER CHECK-IN</span>
                          <span class="t-small">No speech detected yet — would you like to pause the exam?</span>
                        </div>
                        <div class="ws-pause-offer-actions">
                          <button type="button" class="btn-primary btn-sm t-micro" id="ws-pause-offer-accept-btn"><span>Pause Exam</span></button>
                          <button type="button" class="chip-toggle t-micro" id="ws-pause-offer-dismiss-btn">(I'm Here)</button>
                        </div>
                      </div>`
                    : ''
                }
                <div class="ws-silence-strip" id="ws-silence-strip" style="display:none;">
                  <span class="t-micro fw-600" id="ws-silence-label">Quiet pause · advancing soon…</span>
                  <div class="ws-silence-track"><div class="ws-silence-fill" id="ws-silence-fill"></div></div>
                </div>
                <div class="ws-3d-action-bar">
                  ${
                    canPause
                      ? `<button type="button" class="chip-toggle ws-pause-btn t-micro${speakingPaused ? ' is-active' : ''}" id="ws-speak-pause-btn" aria-pressed="${speakingPaused ? 'true' : 'false'}">
                          ${speakingPaused ? '▶ Resume' : '⏸ Pause'}
                        </button>`
                      : ''
                  }
                  ${
                    speakingPhase === 'prep' && !speakingPaused
                      ? `<button type="button" class="btn-primary btn-sm t-micro" id="ws-speak-skip-prep-btn"><span>Speak Now →</span></button>`
                      : ''
                  }
                  ${
                    speakingPhase === 'candidate_speaking' && !speakingPaused
                      ? `<button type="button" class="chip-toggle t-micro" id="ws-speak-mute-btn" aria-pressed="${speakingMicMuted ? 'true' : 'false'}">(${speakingMicMuted ? 'Unmute Mic' : 'Mute Mic'})</button>
                         <button type="button" class="btn-primary btn-sm t-micro" id="ws-speak-finish-stage-btn"><span>${nextTurn ? 'Finish Stage →' : 'Finish &amp; Score →'}</span></button>`
                      : ''
                  }
                  ${
                    speakingPhase === 'complete'
                      ? `<button type="button" class="btn-primary btn-sm t-micro" id="ws-speak-restart-btn-2"><span>Run Mock Again</span></button>`
                      : ''
                  }
                </div>
              </div>`
            : ''
        }
      </div>

      ${
        speakingPhase === 'complete' && speakingResult
          ? (() => {
              const nativeSpeak = buildNativeRubricScore(
                activeTest.examId,
                activeTest.sectionKey,
                speakingResult.qualityRatio,
                speakingResult.overall,
                `${speakingResult.turnsAnswered}/${turns.length} stages`
              );
              const isIeltsS = activeTest.examId === 'ielts';
              const fmtCrit = (bandVal: number) =>
                isIeltsS ? bandVal.toFixed(1) : `${Math.round((bandVal / 9) * 100)}%`;
              return `<div class="ws-rubric-panel" style="margin-top:16px;">
              <div class="ws-rubric-head">
                <div>
                  <p class="t-micro">(${esc(nativeSpeak.sectionBadge)} Report · ${speakingResult.turnsAnswered}/${turns.length} Stages Captured)</p>
                  <h3 class="t-lead tnum">${esc(nativeSpeak.headline)}</h3>
                </div>
                <div class="ws-toolbar-group">
                  <span class="t-micro">${speakingSavedCloud ? 'Saved to Firebase' : snap.user ? 'Syncing…' : 'Local score only'}</span>
                  <button type="button" class="chip-toggle t-micro" id="ws-speak-toggle-transcripts-btn">
                    (${speakingTranscriptOpen ? 'Hide Stage Transcripts' : 'View Captured Transcripts'})
                  </button>
                </div>
              </div>
              <div class="ws-rubric-grid tnum">
                <div class="ws-rubric-cell"><span class="t-micro">Fluency &amp; Coherence</span><strong class="t-lead">${fmtCrit(speakingResult.fc)}</strong></div>
                <div class="ws-rubric-cell"><span class="t-micro">Lexical Resource</span><strong class="t-lead">${fmtCrit(speakingResult.lr)}</strong></div>
                <div class="ws-rubric-cell"><span class="t-micro">Grammar Range</span><strong class="t-lead">${fmtCrit(speakingResult.gra)}</strong></div>
                <div class="ws-rubric-cell"><span class="t-micro">Pronunciation</span><strong class="t-lead">${fmtCrit(speakingResult.pron)}</strong></div>
              </div>
              <ul class="access-list t-small" style="margin-top:12px;">
                ${speakingResult.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
              </ul>
              ${
                speakingTranscriptOpen
                  ? `<div class="ws-stage-transcripts">
                      ${turns
                        .map((t, idx) => {
                          const txt = (speakingResponses[idx] || '').trim();
                          return `<div class="ws-stage-transcript-item">
                            <p class="t-micro fw-600">STAGE ${String(idx + 1).padStart(2, '0')} · ${esc(t.label)}</p>
                            <p class="t-small" style="margin-top:4px;">${txt ? esc(txt) : '<em style="opacity:0.65;">(No speech captured in this stage)</em>'}</p>
                          </div>`;
                        })
                        .join('')}
                    </div>`
                  : ''
              }
            </div>`;
            })()
          : ''
      }
    `;
  }

  // --- TAB 5: PROGRESS & RESULTS DASHBOARD (PER-EXAM NATIVE SCORING) ---
  function renderProgressTab(snap: CloudSnapshot): string {
    if (!snap.user) {
      return `
        <div class="ws-gate-card">
          <p class="t-micro">(app/progress &amp; app/results · Google Sign-In Required)</p>
          <h2 class="t-h2" style="margin-top:8px;">Sign in with Google to track each exam on its native scale.</h2>
          <p class="t-body" style="margin-top:10px;max-width:60ch;">Your exam-specific score goals, section-level readiness breakdowns, and attempt history across IELTS, NEC (HSGQG), Digital SAT, HSG Tiếng Anh, and Olympic 30/4 are stored privately under your Google account.</p>
          <div style="margin-top:20px;">
            <button type="button" class="ws-google-btn t-small" id="ws-gate-google-btn" ${authBusy ? 'disabled' : ''}>
              ${googleMarkSvg()}
              <span>${authBusy ? 'Opening Google…' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>
      `;
    }

    const profile = snap.profile;
    const roadmapCount = profile?.completedRoadmapSteps.length ?? 0;
    const fc = computeExamForecast(progressFocusExam, snap.attempts, profile, roadmapCount);
    const cfg = fc.config;
    const allClassified = snap.attempts.map(classifyAttempt);
    const displayedAttempts = progressShowAllExams ? allClassified : fc.examAttempts;

    return `
      <div class="ws-toolbar" style="margin-bottom:16px;">
        <div class="ws-toolbar-group" role="group" aria-label="Select standardized exam">
          <span class="t-micro fw-600">Exam Track:</span>
          ${EXAM_ORDER.map((eid) => {
            const ex = EXAM_CONFIGS[eid];
            return `<button type="button" class="chip-toggle t-micro" data-progress-exam="${eid}" aria-pressed="${progressFocusExam === eid ? 'true' : 'false'}">${esc(ex.short)}</button>`;
          }).join('')}
        </div>
        <span class="t-micro tnum">${esc(cfg.fullName)} · Native Scale: <strong>${esc(cfg.scaleRangeLabel)}</strong></span>
      </div>

      <div class="ws-progress-top">
        <div class="ws-kpi-card">
          <span class="t-micro">${esc(cfg.short)} Current Baseline</span>
          <strong class="t-h1 tnum" style="margin-top:6px;">${fc.currentScore !== null ? esc(cfg.formatShort(fc.currentScore)) : '—'}</strong>
          <span class="t-micro tnum" style="margin-top:4px;">${fc.currentScore !== null ? esc(cfg.formatScore(fc.currentScore)) : `No ${esc(cfg.short)} mocks yet`} · Goal ${esc(cfg.formatScore(fc.target))}</span>
        </div>
        <div class="ws-kpi-card">
          <span class="t-micro">${esc(cfg.short)} Attempts</span>
          <strong class="t-h1 tnum" style="margin-top:6px;">${fc.totalExamAttempts}</strong>
          <span class="t-micro" style="margin-top:4px;">${fc.sectionsLoggedCount}/${cfg.sections.length} native sections logged</span>
        </div>
        <div class="ws-kpi-card">
          <span class="t-micro">Study Roadmap</span>
          <strong class="t-h1 tnum" style="margin-top:6px;">${roadmapCount}/24</strong>
          <span class="t-micro" style="margin-top:4px;"><a class="u-anim" href="#/schedule">(Open 12-week roadmap)</a></span>
        </div>
        <div class="ws-kpi-card">
          <span class="t-micro">${esc(cfg.short)} Exam Date</span>
          <strong class="t-lead tnum" style="margin-top:10px;">${esc(fc.examDate)}</strong>
          <span class="t-micro tnum" style="margin-top:6px;">${fc.daysLeft}d remaining</span>
        </div>
      </div>

      <div class="ws-reading-split" style="margin-top:20px;">
        <div class="ws-pane">
          <p class="t-micro fw-600">${esc(cfg.short)} · Section Readiness Breakdown (${esc(cfg.scaleRangeLabel)})</p>
          ${cfg.noSpeakingNote ? `<p class="t-micro" style="margin-top:6px;opacity:0.78;">${esc(cfg.noSpeakingNote)}</p>` : ''}
          <div class="ws-skill-bars">
            ${fc.sectionRows
              .map((row) => {
                return `
                  <div class="ws-skill-bar-row">
                    <div class="ws-skill-bar-head t-small">
                      <span class="fw-600">${esc(row.section.label)}</span>
                      <span class="tnum">${esc(row.bestDisplayValue)} · <a class="u-anim" href="${esc(row.practiceHref)}">Practice</a></span>
                    </div>
                    <div class="ws-bar-track"><div class="ws-bar-fill" style="width:${row.fillPct}%;background:${row.section.color}"></div></div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <form class="ws-pane" id="ws-goals-form">
          <p class="t-micro fw-600">Update ${esc(cfg.short)} Goal &amp; Exam Date</p>
          <div class="ws-form-grid" style="margin-top:12px;">
            <div class="field-group">
              <label class="t-micro" for="ws-goal-name">Display Name</label>
              <input id="ws-goal-name" class="text-input t-small" type="text" maxlength="120" required value="${esc(profile?.displayName || snap.user.displayName || '')}"/>
            </div>
            <div class="field-group">
              <label class="t-micro" for="ws-goal-target">Target ${esc(cfg.scaleName)} (${esc(cfg.scaleRangeLabel)})</label>
              <select id="ws-goal-target" class="text-input t-small tnum">
                ${cfg.targetOptions
                  .map(
                    (opt) =>
                      `<option value="${opt}" ${Math.abs(fc.target - opt) < 0.01 ? 'selected' : ''}>${esc(cfg.formatScore(opt))}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="field-group">
              <label class="t-micro" for="ws-goal-date">${esc(cfg.short)} Exam Date (YYYY-MM-DD)</label>
              <input id="ws-goal-date" class="text-input t-small tnum" type="date" required value="${esc(fc.examDate)}"/>
            </div>
          </div>
          <div style="margin-top:14px;">
            <button type="submit" class="btn-primary btn-sm t-small" ${savingGoals ? 'disabled' : ''}><span>${savingGoals ? 'Saving…' : `Save ${esc(cfg.short)} Target`}</span></button>
          </div>
        </form>
      </div>

      <div class="ws-pane" style="margin-top:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <p class="t-micro fw-600">${progressShowAllExams ? `All Standardized Exam Attempts (${allClassified.length})` : `${esc(cfg.short)} Attempt History (${fc.examAttempts.length})`}</p>
          <button type="button" class="chip-toggle t-micro" id="ws-progress-toggle-all" aria-pressed="${progressShowAllExams ? 'true' : 'false'}">
            (${progressShowAllExams ? `Filter to ${esc(cfg.short)} Only` : `Show All Exams (${allClassified.length})`})
          </button>
        </div>
        ${
          displayedAttempts.length === 0
            ? `<p class="t-small" style="margin-top:12px;">No ${progressShowAllExams ? '' : `${esc(cfg.short)} `}attempts logged yet. Select any ${esc(cfg.short)} section above and click Practice to record your first native ${esc(cfg.scaleName)} result.</p>`
            : `
          <table class="data-table responsive-table" style="margin-top:12px;">
            <thead>
              <tr>
                <th class="t-micro">Date</th>
                <th class="t-micro">Exam &amp; Section</th>
                <th class="t-micro">Practice Set</th>
                <th class="t-micro">Section Score</th>
                <th class="t-micro">Exam Scale</th>
                <th class="t-micro">Summary</th>
                <th class="t-micro">Action</th>
              </tr>
            </thead>
            <tbody>
              ${displayedAttempts
                .map((c) => {
                  const a = c.attempt;
                  const exCfg = EXAM_CONFIGS[c.examId];
                  return `
                <tr>
                  <td data-label="Date" class="t-micro tnum">${esc(fmtDateShort(a.createdAtMs))}</td>
                  <td data-label="Exam & Section" class="t-small"><span class="track-chip track-chip-${esc(a.skill)}">${esc(exCfg.short)} · ${esc(c.sectionLabel)}</span></td>
                  <td data-label="Practice Set" class="t-small fw-600">${esc(a.testTitle)}</td>
                  <td data-label="Section Score" class="t-small fw-600 tnum">${esc(c.nativeSectionLabel)}</td>
                  <td data-label="Exam Scale" class="t-micro tnum">${esc(c.nativeScoreLabel)}</td>
                  <td data-label="Summary" class="t-micro">${esc(a.summary)}</td>
                  <td data-label="Action" class="t-micro">
                    <button type="button" class="btn-text t-micro u-anim" data-del-attempt="${esc(a.id)}">(Delete)</button>
                  </td>
                </tr>
              `;
                })
                .join('')}
            </tbody>
          </table>
        `
        }
      </div>
    `;
  }

  // --- TAB 6: TEST BANK ADMIN STUDIO ---
  function renderAdminTab(snap: CloudSnapshot): string {
    if (!snap.user) {
      return `
        <div class="ws-gate-card">
          <p class="t-micro">(app/admin · Verified Google Sign-In Required)</p>
          <h2 class="t-h2" style="margin-top:8px;">Sign in with Google to access the Test Bank Studio.</h2>
          <p class="t-body" style="margin-top:10px;">Verified learners can browse published custom Cambridge-style drills; verified administrators can ingest, publish, and manage bank items directly in Firestore.</p>
          <div style="margin-top:20px;">
            <button type="button" class="ws-google-btn t-small" id="ws-gate-google-btn" ${authBusy ? 'disabled' : ''}>
              ${googleMarkSvg()}
              <span>${authBusy ? 'Opening Google…' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="ws-reading-split">
        <div class="ws-pane">
          <p class="t-micro fw-600">Ingest New Cambridge-Style Test Item</p>
          ${
            snap.isAdmin
              ? `
            <form id="ws-admin-form" style="margin-top:12px;display:flex;flex-direction:column;gap:12px;">
              <div class="field-group">
                <label class="t-micro" for="adm-skill">Skill</label>
                <select id="adm-skill" class="text-input t-small">
                  <option value="writing">Writing (appears live in Writing Studio)</option>
                  <option value="reading">Reading</option>
                  <option value="listening">Listening</option>
                  <option value="speaking">Speaking</option>
                </select>
              </div>
              <div class="field-group">
                <label class="t-micro" for="adm-source">Source Bank</label>
                <input id="adm-source" class="text-input t-small" type="text" maxlength="80" required placeholder="e.g. Cambridge IELTS 20 · Test 3"/>
              </div>
              <div class="field-group">
                <label class="t-micro" for="adm-title">Title</label>
                <input id="adm-title" class="text-input t-small" type="text" maxlength="160" required placeholder="e.g. Urban Transit vs. Green Spaces"/>
              </div>
              <div class="field-group">
                <label class="t-micro" for="adm-prompt">Prompt / Passage Content</label>
                <textarea id="adm-prompt" class="ws-textarea t-small" rows="5" maxlength="4000" required placeholder="Paste the full IELTS prompt or passage text..."></textarea>
              </div>
              <label class="ws-opt-label t-small">
                <input id="adm-pub" type="checkbox" checked/>
                <span>Publish immediately to signed-in learners</span>
              </label>
              <div>
                <button type="submit" class="btn-primary btn-sm t-small" ${adminBusy ? 'disabled' : ''}><span>${adminBusy ? 'Publishing…' : 'Add to Firestore Test Bank'}</span></button>
              </div>
            </form>
          `
              : `
            <p class="t-small" style="margin-top:10px;">You are signed in as a verified learner (${esc(snap.user.email || '')}). Only verified platform administrators can create or modify Test Bank records in Firestore; published items remain visible on the right.</p>
          `
          }
        </div>

        <div class="ws-pane">
          <p class="t-micro fw-600">Firestore Test Bank (${snap.testBank.length} item${snap.testBank.length === 1 ? '' : 's'})</p>
          ${
            snap.testBank.length === 0
              ? `<p class="t-small" style="margin-top:12px;">No custom test bank items stored yet.${snap.isAdmin ? ' Use the form on the left to publish a custom Cambridge prompt.' : ''}</p>`
              : `
            <div class="ws-questions-list" style="margin-top:12px;">
              ${snap.testBank
                .map(
                  (item) => `
                <article class="ws-q-card">
                  <div class="ws-q-top">
                    <span class="t-micro fw-600">${esc(item.source)} · ${esc(SKILL_META[item.skill].label)}</span>
                    <span class="t-micro">${item.published ? 'Published' : 'Draft'}</span>
                  </div>
                  <h3 class="t-small fw-600" style="margin-top:6px;">${esc(item.title)}</h3>
                  <p class="t-micro" style="margin-top:6px;">${esc(item.prompt.slice(0, 220))}${item.prompt.length > 220 ? '…' : ''}</p>
                  ${
                    snap.isAdmin
                      ? `<div class="ws-toolbar-group" style="margin-top:10px;">
                          <button type="button" class="chip-toggle t-micro" data-adm-toggle="${esc(item.id)}" data-adm-next="${item.published ? 'false' : 'true'}">(${item.published ? 'Unpublish' : 'Publish'})</button>
                          <button type="button" class="btn-text t-micro u-anim" data-adm-del="${esc(item.id)}">(Delete)</button>
                        </div>`
                      : ''
                  }
                </article>
              `
                )
                .join('')}
            </div>
          `
          }
        </div>
      </div>
    `;
  }

  function renderWorkspaceLoginGate(snap: CloudSnapshot): string {
    if (!snap.authReady) {
      return `
        <div class="ws-gate-card">
          <p class="t-micro">(Firebase Authentication Check)</p>
          <h2 class="t-h2" style="margin-top:8px;">Verifying your Google session…</h2>
          <p class="t-small" style="margin-top:8px;">Mock exams are unlocked automatically once your verified account is confirmed.</p>
        </div>
      `;
    }
    return `
      <div class="ws-gate-card">
        <p class="t-micro">(Login-Only Mock Exam Sandbox · Firebase Google Auth)</p>
        <h2 class="t-h2" style="margin-top:8px;">Sign in with Google to unlock all 4 Mock Exams.</h2>
        <p class="t-body" style="margin-top:10px;max-width:64ch;">Mock exams for Reading, Listening, Writing, and the 3D Live Speaking Examiner are private to signed-in accounts so you can test timers, rubrics, audio, and live voice before uploading your official exam bank.</p>
        <div class="ws-lock-grid">
          <div class="ws-lock-tile">
            <span class="ws-mock-badge t-micro">LOCKED</span><span class="t-micro fw-600">Reading Mocks (2 Sets)</span>
            <p class="t-micro" style="margin-top:6px;">IELTS Academic + NEC/SAT mixed drill with highlighter, timers &amp; evidence keys.</p>
          </div>
          <div class="ws-lock-tile">
            <span class="ws-mock-badge t-micro">LOCKED</span><span class="t-micro fw-600">Listening Mocks (2 Sets)</span>
            <p class="t-micro" style="margin-top:6px;">Part 2/3 distractor dialogue &amp; Part 4 lecture with exam lock &amp; unlocked transcript.</p>
          </div>
          <div class="ws-lock-tile">
            <span class="ws-mock-badge t-micro">LOCKED</span><span class="t-micro fw-600">Writing Mocks (2 Sets)</span>
            <p class="t-micro" style="margin-top:6px;">Task 1 interactive chart + Task 2 essay with live word floor &amp; rubric scorer.</p>
          </div>
          <div class="ws-lock-tile">
            <span class="ws-mock-badge t-micro">LOCKED</span><span class="t-micro fw-600">3D Speaking Mocks (2 Sets)</span>
            <p class="t-micro" style="margin-top:6px;">IELTS Parts 1–3 &amp; NEC Day 2 C1–C2 debate with 3D examiner &amp; Gemini 3.8 Live voice.</p>
          </div>
        </div>
        <div style="margin-top:20px;">
          <button type="button" class="ws-google-btn t-small" id="ws-gate-google-btn" ${authBusy ? 'disabled' : ''}>
            ${googleMarkSvg()}
            <span>${authBusy ? 'Opening Google…' : 'Sign in with Google to Test Mock Exams'}</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderMockSuiteBar(): string {
    return `
      <div class="ws-mock-suite" role="region" aria-label="Mock exam quick launcher">
        <div>
          <span class="ws-mock-badge t-micro">MOCK SUITE UNLOCKED</span>
          <span class="t-small fw-600">Staging Mock Exams (Login-Only Sandbox)</span>
          <p class="t-micro" style="margin-top:3px;">Test every skill player, live voice examiner, and Firebase attempt logging before uploading your official exams in Test Bank Admin.</p>
        </div>
        <div class="ws-mock-suite-actions">
          <button type="button" class="chip-toggle t-micro" data-launch-mock="reading">(Mock Reading)</button>
          <button type="button" class="chip-toggle t-micro" data-launch-mock="listening">(Mock Listening)</button>
          <button type="button" class="chip-toggle t-micro" data-launch-mock="writing">(Mock Writing)</button>
          <button type="button" class="chip-toggle t-micro" data-launch-mock="speaking">(Mock 3D Speaking)</button>
        </div>
      </div>
    `;
  }

  function render(): void {
    if (!rootEl) return;
    const snap = getCloud();
    const isAuthenticated = Boolean(snap.authReady && snap.user);

    let bodyHtml = '';
    if (!isAuthenticated) {
      bodyHtml = renderWorkspaceLoginGate(snap);
    } else if (activeTab === 'reading') {
      bodyHtml = renderReadingTab(snap);
    } else if (activeTab === 'listening') {
      bodyHtml = renderListeningTab(snap);
    } else if (activeTab === 'writing') {
      bodyHtml = renderWritingTab(snap);
    } else if (activeTab === 'speaking') {
      bodyHtml = renderSpeakingTab(snap);
    } else if (activeTab === 'progress') {
      bodyHtml = renderProgressTab(snap);
    } else {
      bodyHtml = renderAdminTab(snap);
    }

    rootEl.innerHTML = `
      <section class="sub-sec ws-shell" data-surface="paper" data-pager="Workspace">
        <div class="grid">
          <div class="col-full">
            <div class="ws-top-head">
              <div>
                <p class="t-micro">(Interactive Multi-Exam Workspace · Login-Gated Mock Exams)</p>
                <h1 class="t-h1" tabindex="-1" style="margin-top:6px;">ieafl Practice Studio</h1>
              </div>
            </div>
            ${renderAuthBar(snap)}
            ${isAuthenticated ? renderMockSuiteBar() : ''}
            ${
              statusNotice || snap.authError
                ? `<div class="ws-notice ${statusKind === 'err' || snap.authError ? 'is-err' : 'is-ok'} t-small" role="status" aria-live="polite">
                    <span>${esc(statusNotice || snap.authError || '')}</span>
                    <button type="button" class="btn-text t-micro" id="ws-notice-dismiss">(Dismiss)</button>
                  </div>`
                : ''
            }
            ${isAuthenticated ? renderTabStrip(snap) : ''}
            <div class="ws-body" id="ws-active-body">${bodyHtml}</div>
          </div>
        </div>
      </section>
    `;

    if (isAuthenticated && activeTab === 'speaking') {
      const slot = rootEl.querySelector('#ws-3d-stage-slot');
      if (slot) {
        slot.appendChild(examiner3dHost);
        examiner3d.mount(examiner3dHost);
      }
      if (speakingPhase === 'idle') {
        ensureSpeakingPreload(false);
      }
    } else {
      if (!isAuthenticated) {
        cancelSpeakingPreload();
        abortActiveSpeakingRun(true);
      }
      examiner3d.unmount();
    }

    bindEvents();
    enhanceIeaflSelects(rootEl);
  }

  function applyReadingHighlight(): void {
    const body = document.getElementById('ws-passage-body');
    const sel = window.getSelection();
    if (!body || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setNotice('Select text inside the Reading passage first, then click Highlight.', 'ok');
      render();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!body.contains(range.commonAncestorContainer)) {
      setNotice('Selection must be inside the Reading passage text.', 'ok');
      render();
      return;
    }
    const mark = document.createElement('mark');
    mark.className = `ws-hl-${readingHighlightColor}`;
    try {
      range.surroundContents(mark);
      sel.removeAllRanges();
    } catch {
      const text = range.toString();
      if (text) {
        range.deleteContents();
        mark.textContent = text;
        range.insertNode(mark);
        sel.removeAllRanges();
      }
    }
  }

  function startListeningPlayback(): void {
    const test = LISTENING_TESTS[listeningTestIdx] || LISTENING_TESTS[0];
    if (listeningExamLock && !listeningSubmitted && listeningPlayCount >= 1) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setNotice('Browser speech synthesis is unavailable here. Submit to view the full Listening transcript.', 'err');
      render();
      return;
    }
    stopListeningPlayback();
    playBeep();
    listeningPlaying = true;
    listeningCueIdx = 0;

    const speakNext = (idx: number) => {
      if (!listeningPlaying) return;
      if (idx >= test.cues.length) {
        listeningPlaying = false;
        listeningPlayCount++;
        render();
        return;
      }
      listeningCueIdx = idx;
      render();
      const cue = test.cues[idx];
      const u = new SpeechSynthesisUtterance(cue.text);
      u.lang = 'en-GB';
      u.rate = listeningRate;
      u.pitch = cue.voiceRole === 'guest' ? 1.12 : cue.voiceRole === 'lecturer' ? 0.92 : 1.0;
      u.onend = () => {
        if (listeningPlaying) speakNext(idx + 1);
      };
      u.onerror = () => {
        listeningPlaying = false;
        render();
      };
      window.speechSynthesis.speak(u);
    };

    speakNext(0);
  }

  // --- Game-Level Speaking Stage Runner (Pre-Generated TTS + Uninterrupted Recording + Time-Freeze Pause) ---
  function startCountdownClock(initialSec: number, token: number, onZero: () => void): void {
    stopSpeakingClock(false);
    speakingTimeLeft = Math.max(0, Math.floor(initialSec));
    speakingClockToken = token;
    speakingClockOnZero = onZero;
    const initialEl = document.getElementById('ws-speaking-clock');
    if (initialEl) initialEl.textContent = fmtClock(speakingTimeLeft);

    if (speakingPaused) return;

    speakingTimerId = window.setInterval(() => {
      if (token !== speakingSessionToken) {
        stopSpeakingClock(true);
        return;
      }
      if (speakingPaused) return;
      if (speakingTimeLeft > 0) {
        speakingTimeLeft--;
        const el = document.getElementById('ws-speaking-clock');
        if (el) el.textContent = fmtClock(speakingTimeLeft);
        if (speakingTimeLeft === 0) {
          const cb = speakingClockOnZero;
          stopSpeakingClock(true);
          cb?.();
        }
      } else {
        const cb = speakingClockOnZero;
        stopSpeakingClock(true);
        cb?.();
      }
    }, 1000);
  }

  function scheduleStageTransition(delayMs: number, token: number, onDone: () => void): void {
    if (speakingTransitionTimerId !== null) {
      window.clearTimeout(speakingTransitionTimerId);
      speakingTransitionTimerId = null;
    }
    speakingTransitionRemainingMs = Math.max(120, delayMs);
    speakingTransitionCallback = onDone;
    speakingTransitionStartedAt = performance.now();
    if (speakingPaused) return;
    speakingTransitionTimerId = window.setTimeout(() => {
      speakingTransitionTimerId = null;
      speakingTransitionCallback = null;
      speakingTransitionRemainingMs = 0;
      if (token !== speakingSessionToken || speakingPaused) return;
      onDone();
    }, speakingTransitionRemainingMs);
  }

  function toggleSpeakingPause(forcePause?: boolean, customReason = ''): void {
    const canPause =
      speakingPhase === 'examiner_speaking' ||
      speakingPhase === 'prep' ||
      speakingPhase === 'candidate_speaking' ||
      speakingPhase === 'stage_clear';
    if (!canPause) return;

    const nextPaused = typeof forcePause === 'boolean' ? forcePause : !speakingPaused;
    if (nextPaused === speakingPaused) return;
    speakingPaused = nextPaused;

    if (speakingPaused) {
      speakingPauseReason = customReason;
      speakingPauseOfferVisible = false;
      // If a check-in line was mid-playback, stop it cleanly so Resume returns directly to listening
      if (speakingCheckInBusy) {
        speakingCheckInBusy = false;
        speakingEngine.stopExaminerPlayback();
        examiner3d.setAudioLevels(0, 0);
        examiner3d.setMood('listening');
      }
      // Freeze countdown clock without losing remaining seconds or callback
      if (speakingTimerId !== null) {
        window.clearInterval(speakingTimerId);
        speakingTimerId = null;
      }
      // Freeze stage transition countdown with exact remaining duration
      if (speakingTransitionTimerId !== null) {
        window.clearTimeout(speakingTransitionTimerId);
        speakingTransitionTimerId = null;
        const elapsed = performance.now() - speakingTransitionStartedAt;
        speakingTransitionRemainingMs = Math.max(150, speakingTransitionRemainingMs - elapsed);
      }
      speakingEngine.setExaminerPaused(true);
      activeStageRecorder?.setPaused(true);
      examiner3d.setPaused(true);
    } else {
      speakingPauseReason = '';
      speakingCheckInCount = 0;
      examiner3d.setPaused(false);
      speakingEngine.setExaminerPaused(false);
      activeStageRecorder?.resetNoSpeechTimer();
      activeStageRecorder?.setPaused(false);
      if (
        (speakingPhase === 'prep' || speakingPhase === 'candidate_speaking') &&
        speakingClockOnZero &&
        speakingClockToken === speakingSessionToken
      ) {
        startCountdownClock(speakingTimeLeft, speakingClockToken, speakingClockOnZero);
      }
      if (speakingPhase === 'stage_clear' && speakingTransitionCallback) {
        scheduleStageTransition(
          speakingTransitionRemainingMs || 800,
          speakingSessionToken,
          speakingTransitionCallback
        );
      }
    }
    render();
  }

  async function handleNoSpeechCheckIn(token: number): Promise<void> {
    if (
      token !== speakingSessionToken ||
      speakingPhase !== 'candidate_speaking' ||
      speakingPaused ||
      speakingSpeechHeard ||
      speakingCheckInBusy
    ) {
      return;
    }

    speakingCheckInCount++;
    const activeTest = getActiveSpeakingTest();
    const prefs = getExaminerSettings();
    const examMode = activeTest.examMode || 'ielts';

    // Second quiet window with still zero speech -> auto-freeze cleanly so exam time isn't wasted
    if (speakingCheckInCount >= 2) {
      toggleSpeakingPause(
        true,
        `Paused automatically after no speech was detected — clock frozen at ${fmtClock(speakingTimeLeft)}. Click Resume whenever you're ready.`
      );
      return;
    }

    // First quiet threshold -> examiner plays a pre-generated check-in line & offers to pause
    speakingCheckInBusy = true;
    speakingPauseOfferVisible = true;
    // Briefly pause mic capture while the examiner speaks so speaker audio never leaks into transcript
    activeStageRecorder?.setPaused(true);
    examiner3d.setMood('speaking');
    examiner3d.setAudioLevels(0, 0);
    render();

    const line = pickExaminerCheckInLine();
    await speakingEngine.speakExaminerPrompt(line, prefs.voiceName, examMode, (rms) => {
      if (token === speakingSessionToken && !speakingPaused) {
        examiner3d.setAudioLevels(rms, 0);
      }
    });

    if (token !== speakingSessionToken) return;
    speakingCheckInBusy = false;

    if (!speakingPaused && speakingPhase === 'candidate_speaking') {
      examiner3d.setAudioLevels(0, 0);
      examiner3d.setMood('listening');
      activeStageRecorder?.resetNoSpeechTimer();
      activeStageRecorder?.setPaused(false);
    }
  }

  function updateSilenceHud(remainingSec: number | null, totalSec: number): void {
    const strip = document.getElementById('ws-silence-strip');
    const label = document.getElementById('ws-silence-label');
    const fill = document.getElementById('ws-silence-fill');
    if (!strip || !label || !fill) return;
    if (remainingSec === null || speakingPaused) {
      strip.style.display = 'none';
      return;
    }
    strip.style.display = 'flex';
    const pct = Math.min(100, Math.max(0, ((totalSec - remainingSec) / Math.max(0.1, totalSec)) * 100));
    fill.style.width = `${pct.toFixed(1)}%`;
    label.textContent = `Quiet pause · next stage in ${Math.ceil(remainingSec)}s (keep speaking to continue)`;
  }

  async function finalizeSpeakingExam(token: number): Promise<void> {
    if (token !== speakingSessionToken) return;
    const activeTest = getActiveSpeakingTest();
    speakingPaused = false;
    examiner3d.setPaused(false);
    speakingPhase = 'scoring';
    examiner3d.setMood('thinking');
    examiner3d.setAudioLevels(0, 0);
    render();

    // Wait for every background per-stage transcription so Parts 1, 2, 3, 4, 5 are all included
    const pending = Object.values(speakingStagePromises);
    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }
    if (token !== speakingSessionToken) return;

    speakingEngine.releaseMicrophone();
    speakingResult = evaluateSpeakingRubric(speakingResponses, activeTest.turns.length);
    speakingPhase = 'complete';
    examiner3d.setMood('idle');
    playStageClearChime();
    render();

    const totalSec = activeTest.turns.reduce((acc, t) => acc + t.speakSec, 0);
    const nativeSpeak = buildNativeRubricScore(
      activeTest.examId,
      activeTest.sectionKey,
      speakingResult.qualityRatio,
      speakingResult.overall,
      `${speakingResult.turnsAnswered}/${activeTest.turns.length} stages`
    );
    const summaryDetail =
      activeTest.examId === 'ielts'
        ? `FC ${speakingResult.fc.toFixed(1)} · LR ${speakingResult.lr.toFixed(1)} · GRA ${speakingResult.gra.toFixed(1)} · Pron ${speakingResult.pron.toFixed(1)}.`
        : `${nativeSpeak.sectionBadge}: ${speakingResult.turnsAnswered}/${activeTest.turns.length} stages (${speakingResult.totalWords} words captured).`;
    speakingSavedCloud = await persistAttemptToCloud({
      skill: 'speaking',
      testId: activeTest.id,
      testTitle: activeTest.title,
      band: nativeSpeak.compatBand,
      scoreText: nativeSpeak.scoreText,
      durationSec: totalSec,
      summary: summaryDetail,
    });
    if (token === speakingSessionToken) render();
  }

  async function completeActiveStageAndTransition(token: number): Promise<void> {
    if (token !== speakingSessionToken) return;
    stopSpeakingClock(true);
    const activeTest = getActiveSpeakingTest();
    const capturedIdx = speakingTurnIdx;
    const capturedTurn = activeTest.turns[capturedIdx];

    // Stop active stage recorder cleanly and grab its exact audio blob
    let recordedBlob: Blob | null = null;
    if (activeStageRecorder) {
      const rec = activeStageRecorder;
      activeStageRecorder = null;
      recordedBlob = await rec.stop();
    }
    if (token !== speakingSessionToken) return;

    examiner3d.setAudioLevels(0, 0);
    examiner3d.setMood('idle');
    speakingMicMuted = false;

    // Kick off reliable background Gemini 3.5 Transcribe bound strictly to capturedIdx
    if (recordedBlob && recordedBlob.size >= 400) {
      speakingStageStates[capturedIdx] = 'transcribing';
      const transcribeTask = speakingEngine
        .transcribeStageBlob(recordedBlob, capturedTurn?.label || `Stage ${capturedIdx + 1}`)
        .then((text) => {
          const clean = text.trim();
          if (clean) {
            const prev = (speakingResponses[capturedIdx] || '').trim();
            speakingResponses[capturedIdx] = prev ? `${prev} ${clean}` : clean;
          }
          speakingStageStates[capturedIdx] = 'cleared';
          if (activeTab === 'speaking' && speakingPhase !== 'candidate_speaking') {
            render();
          }
        })
        .catch(() => {
          speakingStageStates[capturedIdx] = 'cleared';
        });
      speakingStagePromises[capturedIdx] = transcribeTask;
    } else {
      speakingStageStates[capturedIdx] = 'cleared';
    }

    const hasNextStage = capturedIdx + 1 < activeTest.turns.length;
    if (!hasNextStage) {
      await finalizeSpeakingExam(token);
      return;
    }

    // Show game-level STAGE CLEARED transition overlay, then auto-launch next stage prompt out loud
    speakingPhase = 'stage_clear';
    playStageClearChime();
    render();

    scheduleStageTransition(1850, token, () => {
      if (token !== speakingSessionToken) return;
      speakingTurnIdx = capturedIdx + 1;
      void runSpeakingStage(speakingTurnIdx, token);
    });
  }

  async function beginCandidateRecordingPhase(stageIdx: number, token: number): Promise<void> {
    if (token !== speakingSessionToken) return;
    const activeTest = getActiveSpeakingTest();
    const turn = activeTest.turns[stageIdx];
    if (!turn) return;

    const prefs = getExaminerSettings();
    const isLongTurn = Boolean(turn.prepSec);
    // Respect the configured 7-second (default) silence auto-advance delay cleanly
    const silenceDelay = prefs.silenceDelaySec;
    const minGraceSec = isLongTurn ? 8.0 : 2.4;
    // Play an examiner check-in & offer to pause if zero speech is heard for 9s (or 11s on Part 2)
    const noSpeechCheckInSec = isLongTurn ? 11.0 : 9.0;

    speakingPhase = 'candidate_speaking';
    speakingTimeLeft = turn.speakSec;
    speakingSpeechHeard = false;
    speakingPauseOfferVisible = false;
    speakingCheckInBusy = false;
    speakingCheckInCount = 0;
    speakingMicMuted = false;
    speakingStageStates[stageIdx] = 'active';
    examiner3d.setMood('listening');
    examiner3d.setAudioLevels(0, 0);
    render();

    // Start the stage countdown clock immediately so it always ticks reliably to 00:00
    startCountdownClock(turn.speakSec, token, () => {
      if (token !== speakingSessionToken) return;
      playBeep();
      void completeActiveStageAndTransition(token);
    });

    try {
      activeStageRecorder = await speakingEngine.startStageRecording({
        silenceDelaySec: silenceDelay,
        autoAdvance: prefs.autoAdvance,
        minSpeakGraceSec: minGraceSec,
        noSpeechCheckInSec,
        onLevel(rms) {
          if (token !== speakingSessionToken || speakingPaused || speakingCheckInBusy) return;
          examiner3d.setAudioLevels(0, rms);
          const fill = document.getElementById('ws-mic-meter-fill');
          if (fill) {
            fill.style.width = `${Math.min(100, Math.round(rms * 140))}%`;
          }
        },
        onSpeechDetected() {
          if (token !== speakingSessionToken) return;
          speakingSpeechHeard = true;
          speakingCheckInCount = 0;
          if (speakingPauseOfferVisible) {
            speakingPauseOfferVisible = false;
            const offerEl = document.getElementById('ws-pause-offer-card');
            if (offerEl) offerEl.style.display = 'none';
          }
        },
        onNoSpeechCheckIn() {
          if (token !== speakingSessionToken || speakingPaused) return;
          void handleNoSpeechCheckIn(token);
        },
        onSilenceCountdown(remainingSec, totalSec) {
          if (token !== speakingSessionToken) return;
          updateSilenceHud(remainingSec, totalSec);
        },
        onAutoSilenceComplete() {
          if (token !== speakingSessionToken || speakingPaused) return;
          void completeActiveStageAndTransition(token);
        },
      });
      if (speakingPaused && activeStageRecorder) {
        activeStageRecorder.setPaused(true);
      }
    } catch (err) {
      if (token !== speakingSessionToken) return;
      setNotice(
        err instanceof Error
          ? `${err.message} Allow microphone access, then click Restart Exam.`
          : 'Microphone permission was denied. Allow microphone access to record speaking stages.',
        'err'
      );
      render();
    }
  }

  async function beginPart2PrepPhase(stageIdx: number, token: number): Promise<void> {
    if (token !== speakingSessionToken) return;
    const activeTest = getActiveSpeakingTest();
    const turn = activeTest.turns[stageIdx];
    if (!turn || !turn.prepSec) {
      await beginCandidateRecordingPhase(stageIdx, token);
      return;
    }

    speakingPhase = 'prep';
    speakingTimeLeft = turn.prepSec;
    examiner3d.setMood('idle');
    examiner3d.setAudioLevels(0, 0);
    render();

    startCountdownClock(turn.prepSec, token, () => {
      if (token !== speakingSessionToken) return;
      void launchPart2SpeechAfterPrep(stageIdx, token);
    });
  }

  async function launchPart2SpeechAfterPrep(stageIdx: number, token: number): Promise<void> {
    if (token !== speakingSessionToken) return;
    stopSpeakingClock(true);
    playBeep();
    const activeTest = getActiveSpeakingTest();
    const prefs = getExaminerSettings();
    const examMode = activeTest.examMode || 'ielts';

    speakingPhase = 'examiner_speaking';
    examiner3d.setMood('speaking');
    render();

    await speakingEngine.speakExaminerPrompt(
      PART2_START_CUE,
      prefs.voiceName,
      examMode,
      (rms) => {
        if (token === speakingSessionToken && !speakingPaused) examiner3d.setAudioLevels(rms, 0);
      }
    );
    if (token !== speakingSessionToken) return;
    await beginCandidateRecordingPhase(stageIdx, token);
  }

  async function runSpeakingStage(stageIdx: number, token: number): Promise<void> {
    if (token !== speakingSessionToken) return;
    const activeTest = getActiveSpeakingTest();
    const turn = activeTest.turns[stageIdx];
    if (!turn) return;

    const prefs = getExaminerSettings();
    const examMode = activeTest.examMode || 'ielts';

    speakingTurnIdx = stageIdx;
    speakingPhase = 'examiner_speaking';
    speakingTimeLeft = turn.prepSec || turn.speakSec;
    speakingStageStates[stageIdx] = 'active';
    examiner3d.setMood('speaking');
    examiner3d.setAudioLevels(0, 0);
    render();

    // Play pre-generated Gemini 3.8 TTS audio immediately from cache
    const ttsRes = await speakingEngine.speakExaminerPrompt(
      turn.prompt,
      prefs.voiceName,
      examMode,
      (rms) => {
        if (token === speakingSessionToken && !speakingPaused) examiner3d.setAudioLevels(rms, 0);
      }
    );
    if (token !== speakingSessionToken) return;
    if (ttsRes.usedFallback && ttsRes.error) {
      setNotice(`Gemini TTS fallback active (${ttsRes.error}). Stage flow continues normally.`, 'err');
    }

    if (turn.prepSec) {
      await beginPart2PrepPhase(stageIdx, token);
    } else {
      await beginCandidateRecordingPhase(stageIdx, token);
    }
  }

  async function startFullSpeakingExam(startIdx = 0): Promise<void> {
    if (speakingPhase === 'idle' && !isSpeakingPreloadComplete()) {
      return;
    }

    abortActiveSpeakingRun(false);
    const token = speakingSessionToken;

    if (startIdx === 0) {
      speakingResponses = {};
      speakingStageStates = {};
      speakingStagePromises = {};
      speakingNotes = '';
      speakingResult = null;
      speakingSavedCloud = false;
      speakingTranscriptOpen = false;
    }

    // Request mic permission ONCE up front so transitions never stall on permission dialogs
    try {
      await speakingEngine.ensureMicrophone();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'Microphone permission is required for the Speaking exam.',
        'err'
      );
      render();
      return;
    }
    if (token !== speakingSessionToken) return;

    await runSpeakingStage(startIdx, token);
  }

  function bindEvents(): void {
    if (!rootEl) return;

    rootEl.querySelector('#ws-google-login-btn')?.addEventListener('click', () => void handleGoogleLogin());
    rootEl.querySelector('#ws-gate-google-btn')?.addEventListener('click', () => void handleGoogleLogin());
    rootEl.querySelector('#ws-reading-save-google')?.addEventListener('click', () => void handleGoogleLogin());
    rootEl.querySelector('#ws-signout-btn')?.addEventListener('click', () => void handleSignOut());
    rootEl.querySelector('#ws-notice-dismiss')?.addEventListener('click', () => {
      statusNotice = '';
      statusKind = '';
      render();
    });

    rootEl.querySelectorAll<HTMLButtonElement>('[data-launch-mock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skill = btn.dataset.launchMock as WorkspaceTab;
        if (!skill) return;
        stopListeningPlayback();
        if (activeTab === 'speaking' && skill !== 'speaking') {
          cancelSpeakingPreload();
          abortActiveSpeakingRun(true);
          examiner3d.unmount();
        }
        if (skill === 'reading') {
          readingTestIdx = 0;
          readingAnswers = {};
          readingFlags = {};
          readingCrossed = {};
          readingActiveQ = 1;
          readingSubmitted = false;
          readingSavedCloud = false;
          readingTimeLeft = READING_TESTS[0].durationSec;
        } else if (skill === 'listening') {
          listeningTestIdx = 0;
          listeningAnswers = {};
          listeningSubmitted = false;
          listeningCueIdx = -1;
          listeningPlayCount = 0;
          listeningSavedCloud = false;
        } else if (skill === 'writing') {
          writingPromptId = WRITING_PROMPTS[0].id;
          writingTimeLeft = WRITING_PROMPTS[0].durationSec;
          writingResult = null;
          writingSavedCloud = false;
        } else if (skill === 'speaking') {
          speakingTestIdx = 0;
          resetSpeakingExamState(false);
        }
        activeTab = skill;
        window.history.replaceState(null, '', `#/workspace/${skill}`);
        setNotice(`Loaded login-only ${skill.toUpperCase()} Mock Exam 01.`, 'ok');
        render();
      });
    });

    rootEl.querySelectorAll<HTMLButtonElement>('[data-ws-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.wsTab as WorkspaceTab;
        if (!next || next === activeTab) return;
        stopListeningPlayback();
        if (activeTab === 'speaking' && next !== 'speaking') {
          cancelSpeakingPreload();
          abortActiveSpeakingRun(true);
          examiner3d.unmount();
        }
        activeTab = next;
        window.history.replaceState(null, '', `#/workspace/${next}`);
        render();
      });
    });

    // --- Reading events ---
    if (activeTab === 'reading') {
      const selEl = rootEl.querySelector<HTMLSelectElement>('#ws-reading-select');
      selEl?.addEventListener('change', () => {
        readingTestIdx = Number(selEl.value) || 0;
        readingAnswers = {};
        readingFlags = {};
        readingCrossed = {};
        readingActiveQ = 1;
        readingSubmitted = false;
        readingSavedCloud = false;
        readingTimeLeft = READING_TESTS[readingTestIdx].durationSec;
        if (readingTimerId !== null) window.clearInterval(readingTimerId);
        readingTimerId = null;
        readingRunning = false;
        render();
      });

      rootEl.querySelector('#ws-reading-timer-btn')?.addEventListener('click', () => {
        if (readingRunning) {
          if (readingTimerId !== null) window.clearInterval(readingTimerId);
          readingTimerId = null;
          readingRunning = false;
        } else {
          readingRunning = true;
          readingTimerId = window.setInterval(() => {
            if (readingTimeLeft > 0) {
              readingTimeLeft--;
              const el = document.getElementById('ws-reading-clock');
              if (el) el.textContent = fmtClock(readingTimeLeft);
            } else if (readingTimerId !== null) {
              window.clearInterval(readingTimerId);
              readingTimerId = null;
              readingRunning = false;
              render();
            }
          }, 1000);
        }
        render();
      });

      const resetReading = () => {
        readingAnswers = {};
        readingFlags = {};
        readingCrossed = {};
        readingSubmitted = false;
        readingSavedCloud = false;
        readingActiveQ = 1;
        readingTimeLeft = READING_TESTS[readingTestIdx].durationSec;
        if (readingTimerId !== null) window.clearInterval(readingTimerId);
        readingTimerId = null;
        readingRunning = false;
        render();
      };
      rootEl.querySelector('#ws-reading-reset-btn')?.addEventListener('click', resetReading);
      rootEl.querySelector('#ws-reading-retry-btn')?.addEventListener('click', resetReading);

      rootEl.querySelectorAll<HTMLButtonElement>('[data-hl-color]').forEach((b) => {
        b.addEventListener('click', () => {
          readingHighlightColor = (b.dataset.hlColor as 'yellow' | 'pink' | 'mint') || 'yellow';
          render();
        });
      });

      rootEl.querySelector('#ws-reading-hl-apply')?.addEventListener('click', applyReadingHighlight);
      rootEl.querySelector('#ws-reading-hl-clear')?.addEventListener('click', () => {
        render();
      });

      rootEl.querySelectorAll<HTMLInputElement>('[data-rq]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const qid = inp.dataset.rq;
          if (qid) readingAnswers[qid] = inp.value;
          const card = inp.closest<HTMLElement>('[data-q-num]');
          if (card) readingActiveQ = Number(card.dataset.qNum) || readingActiveQ;
          render();
        });
      });

      rootEl.querySelectorAll<HTMLInputElement>('[data-rq-text]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const qid = inp.dataset.rqText;
          if (qid) readingAnswers[qid] = inp.value;
        });
        inp.addEventListener('blur', () => render());
      });

      rootEl.querySelectorAll<HTMLButtonElement>('[data-flag-q]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const qid = btn.dataset.flagQ;
          if (qid) readingFlags[qid] = !readingFlags[qid];
          render();
        });
      });

      rootEl.querySelectorAll<HTMLButtonElement>('[data-cross]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.cross;
          if (key) readingCrossed[key] = !readingCrossed[key];
          render();
        });
      });

      rootEl.querySelectorAll<HTMLButtonElement>('[data-jump-q]').forEach((btn) => {
        btn.addEventListener('click', () => {
          readingActiveQ = Number(btn.dataset.jumpQ) || 1;
          render();
          document.getElementById(`ws-q-${readingActiveQ}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });

      rootEl.querySelector('#ws-reading-submit-btn')?.addEventListener('click', async () => {
        const test = READING_TESTS[readingTestIdx];
        if (readingTimerId !== null) window.clearInterval(readingTimerId);
        readingTimerId = null;
        readingRunning = false;
        readingSubmitted = true;
        let correct = 0;
        test.questions.forEach((q) => {
          if ((readingAnswers[q.id] || '').trim().toLowerCase() === q.answer.trim().toLowerCase()) correct++;
        });
        const nativeScore = buildNativeObjectiveScore(test.examId, test.sectionKey, correct, test.questions.length);
        const elapsed = Math.max(10, test.durationSec - readingTimeLeft);
        render();
        readingSavedCloud = await persistAttemptToCloud({
          skill: 'reading',
          testId: test.id,
          testTitle: test.title,
          band: nativeScore.compatBand,
          scoreText: nativeScore.scoreText,
          durationSec: elapsed,
          summary: `${test.source}: ${nativeScore.headline}.`,
        });
        render();
      });
    }

    // --- Listening events ---
    if (activeTab === 'listening') {
      const selEl = rootEl.querySelector<HTMLSelectElement>('#ws-listening-select');
      selEl?.addEventListener('change', () => {
        stopListeningPlayback();
        listeningTestIdx = Number(selEl.value) || 0;
        listeningAnswers = {};
        listeningSubmitted = false;
        listeningCueIdx = -1;
        listeningPlayCount = 0;
        listeningSavedCloud = false;
        render();
      });

      rootEl.querySelector('#ws-listen-lock-btn')?.addEventListener('click', () => {
        listeningExamLock = !listeningExamLock;
        render();
      });

      rootEl.querySelector('#ws-listen-speed-btn')?.addEventListener('click', () => {
        listeningRate = listeningRate >= 1.2 ? 0.9 : Math.round((listeningRate + 0.1) * 10) / 10;
        render();
      });

      rootEl.querySelector('#ws-listen-play-btn')?.addEventListener('click', () => {
        if (listeningPlaying) {
          stopListeningPlayback();
          render();
        } else {
          startListeningPlayback();
        }
      });

      rootEl.querySelectorAll<HTMLInputElement>('[data-lq]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const qid = inp.dataset.lq;
          if (qid) listeningAnswers[qid] = inp.value;
        });
      });

      rootEl.querySelectorAll<HTMLInputElement>('[data-lq-text]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const qid = inp.dataset.lqText;
          if (qid) listeningAnswers[qid] = inp.value;
        });
      });

      rootEl.querySelector('#ws-listen-retry-btn')?.addEventListener('click', () => {
        stopListeningPlayback();
        listeningAnswers = {};
        listeningSubmitted = false;
        listeningCueIdx = -1;
        listeningPlayCount = 0;
        listeningSavedCloud = false;
        render();
      });

      rootEl.querySelector('#ws-listen-submit-btn')?.addEventListener('click', async () => {
        const test = LISTENING_TESTS[listeningTestIdx];
        stopListeningPlayback();
        listeningSubmitted = true;
        let correct = 0;
        test.questions.forEach((q) => {
          const u = (listeningAnswers[q.id] || '').trim().toLowerCase();
          if (q.answers.includes(u)) correct++;
        });
        const nativeScore = buildNativeObjectiveScore(test.examId, test.sectionKey, correct, test.questions.length);
        render();
        listeningSavedCloud = await persistAttemptToCloud({
          skill: 'listening',
          testId: test.id,
          testTitle: test.title,
          band: nativeScore.compatBand,
          scoreText: nativeScore.scoreText,
          durationSec: 180,
          summary: `${test.source}: ${nativeScore.headline} under ${listeningExamLock ? 'single-play exam lock' : 'practice replay'}.`,
        });
        render();
      });
    }

    // --- Writing events ---
    if (activeTab === 'writing') {
      const snap = getCloud();
      const allPrompts = getAllWritingPrompts(snap);
      const current = allPrompts.find((p) => p.id === writingPromptId) || allPrompts[0];

      const selEl = rootEl.querySelector<HTMLSelectElement>('#ws-writing-select');
      selEl?.addEventListener('change', () => {
        writingPromptId = selEl.value;
        const nextP = allPrompts.find((p) => p.id === writingPromptId) || allPrompts[0];
        writingTimeLeft = nextP.durationSec;
        writingResult = null;
        writingSavedCloud = false;
        if (writingTimerId !== null) window.clearInterval(writingTimerId);
        writingTimerId = null;
        writingRunning = false;
        render();
      });

      rootEl.querySelector('#ws-writing-timer-btn')?.addEventListener('click', () => {
        if (writingRunning) {
          if (writingTimerId !== null) window.clearInterval(writingTimerId);
          writingTimerId = null;
          writingRunning = false;
        } else {
          writingRunning = true;
          writingTimerId = window.setInterval(() => {
            if (writingTimeLeft > 0) {
              writingTimeLeft--;
              const el = document.getElementById('ws-writing-clock');
              if (el) el.textContent = fmtClock(writingTimeLeft);
            } else if (writingTimerId !== null) {
              window.clearInterval(writingTimerId);
              writingTimerId = null;
              writingRunning = false;
              render();
            }
          }, 1000);
        }
        render();
      });

      rootEl.querySelector('#ws-writing-reset-btn')?.addEventListener('click', () => {
        writingDrafts[current.id] = '';
        writingTimeLeft = current.durationSec;
        writingResult = null;
        writingSavedCloud = false;
        if (writingTimerId !== null) window.clearInterval(writingTimerId);
        writingTimerId = null;
        writingRunning = false;
        render();
      });

      const editor = rootEl.querySelector<HTMLTextAreaElement>('#ws-writing-editor');
      editor?.addEventListener('input', () => {
        writingDrafts[current.id] = editor.value;
        const w = editor.value.trim() ? editor.value.trim().split(/\s+/).filter(Boolean).length : 0;
        const p = editor.value.trim() ? editor.value.trim().split(/\n\s*\n/).filter((x) => x.trim()).length : 0;
        const statsEl = document.getElementById('ws-writing-stats');
        if (statsEl) {
          statsEl.innerHTML = `<strong style="color:${w >= current.minWords ? '#1A7A54' : '#0A0A0A'}">${w} / ${current.minWords}+ words</strong> · ${p} paragraph${p === 1 ? '' : 's'}`;
        }
      });

      rootEl.querySelector('#ws-writing-submit-btn')?.addEventListener('click', async () => {
        const text = (writingDrafts[current.id] || '').trim();
        if (text.split(/\s+/).filter(Boolean).length < 20) {
          setNotice('Write at least 20 words before running the rubric scorer.', 'err');
          render();
          return;
        }
        if (writingTimerId !== null) window.clearInterval(writingTimerId);
        writingTimerId = null;
        writingRunning = false;
        writingResult = evaluateWritingRubric(text, current.minWords, current.task === 'task1');
        const nativeWriting = buildNativeRubricScore(
          current.examId,
          current.sectionKey,
          writingResult.qualityRatio,
          writingResult.overall,
          `${writingResult.words}w`
        );
        const elapsed = Math.max(30, current.durationSec - writingTimeLeft);
        render();
        const summaryLine =
          current.examId === 'ielts'
            ? `TA/TR ${writingResult.ta.toFixed(1)} · CC ${writingResult.cc.toFixed(1)} · LR ${writingResult.lr.toFixed(1)} · GRA ${writingResult.gra.toFixed(1)}. ${writingResult.notes[0] || ''}`
            : `${nativeWriting.headline} (${writingResult.words} words). ${writingResult.notes[0] || ''}`;
        writingSavedCloud = await persistAttemptToCloud({
          skill: 'writing',
          testId: current.id,
          testTitle: current.title,
          band: nativeWriting.compatBand,
          scoreText: nativeWriting.scoreText,
          durationSec: elapsed,
          summary: summaryLine,
        });
        render();
      });
    }

    // --- Speaking events (Game-Level Stage Controls + Time-Freeze Pause) ---
    if (activeTab === 'speaking') {
      rootEl.querySelector<HTMLSelectElement>('#ws-speaking-select')?.addEventListener('change', (e) => {
        speakingTestIdx = Number((e.target as HTMLSelectElement).value) || 0;
        resetSpeakingExamState(false);
        render();
      });

      rootEl.querySelector('#ws-speak-start-exam-btn')?.addEventListener('click', () => {
        void startFullSpeakingExam(0);
      });

      const handleRestart = () => {
        resetSpeakingExamState(false);
        render();
      };
      rootEl.querySelector('#ws-speak-restart-btn')?.addEventListener('click', handleRestart);
      rootEl.querySelector('#ws-speak-restart-btn-2')?.addEventListener('click', handleRestart);

      rootEl.querySelectorAll<HTMLButtonElement>('[data-speak-jump]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetIdx = Number(btn.dataset.speakJump);
          if (!Number.isFinite(targetIdx)) return;
          void startFullSpeakingExam(targetIdx);
        });
      });

      rootEl.querySelector('#ws-speak-pause-btn')?.addEventListener('click', () => {
        toggleSpeakingPause();
      });

      rootEl.querySelector('#ws-speak-resume-overlay-btn')?.addEventListener('click', () => {
        toggleSpeakingPause(false);
      });

      rootEl.querySelector('#ws-pause-offer-accept-btn')?.addEventListener('click', () => {
        toggleSpeakingPause(true);
      });

      rootEl.querySelector('#ws-pause-offer-dismiss-btn')?.addEventListener('click', () => {
        speakingPauseOfferVisible = false;
        speakingCheckInCount = 0;
        if (speakingCheckInBusy) {
          speakingCheckInBusy = false;
          speakingEngine.stopExaminerPlayback();
          examiner3d.setAudioLevels(0, 0);
          examiner3d.setMood('listening');
        }
        activeStageRecorder?.resetNoSpeechTimer();
        activeStageRecorder?.setPaused(false);
        render();
      });

      rootEl.querySelector('#ws-speak-skip-prep-btn')?.addEventListener('click', () => {
        if (speakingPaused) return;
        const token = speakingSessionToken;
        void launchPart2SpeechAfterPrep(speakingTurnIdx, token);
      });

      rootEl.querySelector('#ws-speak-mute-btn')?.addEventListener('click', () => {
        if (!activeStageRecorder || speakingPaused) return;
        speakingMicMuted = !speakingMicMuted;
        activeStageRecorder.setMuted(speakingMicMuted);
        render();
      });

      rootEl.querySelector('#ws-speak-finish-stage-btn')?.addEventListener('click', () => {
        if (speakingPaused) return;
        const token = speakingSessionToken;
        void completeActiveStageAndTransition(token);
      });

      rootEl.querySelector('#ws-speak-continue-now-btn')?.addEventListener('click', () => {
        if (speakingPhase !== 'stage_clear' || speakingPaused) return;
        stopSpeakingClock(true);
        const token = speakingSessionToken;
        const nextIdx = speakingTurnIdx + 1;
        if (nextIdx < getActiveSpeakingTest().turns.length) {
          speakingTurnIdx = nextIdx;
          void runSpeakingStage(nextIdx, token);
        } else {
          void finalizeSpeakingExam(token);
        }
      });

      rootEl.querySelector<HTMLTextAreaElement>('#ws-speak-notes')?.addEventListener('input', (e) => {
        speakingNotes = (e.target as HTMLTextAreaElement).value;
      });

      rootEl.querySelector('#ws-speak-toggle-transcripts-btn')?.addEventListener('click', () => {
        speakingTranscriptOpen = !speakingTranscriptOpen;
        render();
      });
    }

    // --- Progress events ---
    if (activeTab === 'progress') {
      const snap = getCloud();
      rootEl.querySelectorAll<HTMLButtonElement>('[data-progress-exam]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const eid = btn.dataset.progressExam;
          if (isValidExamId(eid)) {
            progressFocusExam = eid;
            setStoredFocusExam(eid);
            render();
          }
        });
      });

      rootEl.querySelector('#ws-progress-toggle-all')?.addEventListener('click', () => {
        progressShowAllExams = !progressShowAllExams;
        render();
      });

      rootEl.querySelector<HTMLFormElement>('#ws-goals-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!snap.user) return;
        const cfg = EXAM_CONFIGS[progressFocusExam];
        const nameEl = rootEl?.querySelector<HTMLInputElement>('#ws-goal-name');
        const targetEl = rootEl?.querySelector<HTMLSelectElement>('#ws-goal-target');
        const dateEl = rootEl?.querySelector<HTMLInputElement>('#ws-goal-date');
        const displayName = nameEl?.value.trim() || snap.user.displayName || 'Learner';
        const targetVal = Number(targetEl?.value || cfg.defaultTarget);
        const examDate = dateEl?.value || '2026-12-20';
        savingGoals = true;
        render();
        try {
          const savedGoal = saveExamGoalLocal(progressFocusExam, targetVal, examDate);
          const ieltsBandForCloud =
            progressFocusExam === 'ielts'
              ? savedGoal.target
              : snap.profile?.targetBand ?? 7.5;
          const cloudExamDate =
            progressFocusExam === 'ielts'
              ? savedGoal.examDate
              : snap.profile?.examDate || savedGoal.examDate;
          await updateUserGoals(snap.user.uid, {
            displayName,
            targetBand: ieltsBandForCloud,
            examDate: cloudExamDate,
          });
          if (snap.profile) {
            onSyncGoalsSuccess({
              ...snap.profile,
              displayName,
              targetBand: ieltsBandForCloud,
              examDate: cloudExamDate,
            });
          }
          setNotice(
            `Saved ${cfg.short} target ${cfg.formatScore(savedGoal.target)} (exam date ${savedGoal.examDate}).`,
            'ok'
          );
        } catch (err) {
          setNotice(err instanceof Error ? err.message : 'Failed to update goals.', 'err');
        } finally {
          savingGoals = false;
          render();
        }
      });

      rootEl.querySelectorAll<HTMLButtonElement>('[data-del-attempt]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const aid = btn.dataset.delAttempt;
          if (!aid || !snap.user) return;
          try {
            await deleteAttempt(snap.user.uid, aid);
            setNotice('Deleted attempt record from Firebase.', 'ok');
            render();
          } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Could not delete attempt.', 'err');
            render();
          }
        });
      });
    }

    // --- Admin events ---
    if (activeTab === 'admin') {
      const snap = getCloud();
      rootEl.querySelector<HTMLFormElement>('#ws-admin-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!snap.user || !snap.isAdmin) return;
        const skill = (rootEl?.querySelector<HTMLSelectElement>('#adm-skill')?.value || 'writing') as SkillId;
        const source = rootEl?.querySelector<HTMLInputElement>('#adm-source')?.value || 'Cambridge IELTS 20';
        const title = rootEl?.querySelector<HTMLInputElement>('#adm-title')?.value || '';
        const prompt = rootEl?.querySelector<HTMLTextAreaElement>('#adm-prompt')?.value || '';
        const published = Boolean(rootEl?.querySelector<HTMLInputElement>('#adm-pub')?.checked);
        adminBusy = true;
        render();
        try {
          await createCustomTest(snap.user.uid, { skill, source, title, prompt, published });
          setNotice(`Published "${title}" into Firestore /testBank.`, 'ok');
        } catch (err) {
          setNotice(err instanceof Error ? err.message : 'Failed to create test item.', 'err');
        } finally {
          adminBusy = false;
          render();
        }
      });

      rootEl.querySelectorAll<HTMLButtonElement>('[data-adm-toggle]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tid = btn.dataset.admToggle;
          const nextPub = btn.dataset.admNext === 'true';
          if (!tid || !snap.isAdmin) return;
          try {
            await toggleCustomTestPublish(tid, nextPub);
            setNotice(`Updated publish visibility for ${tid}.`, 'ok');
            render();
          } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Failed to toggle visibility.', 'err');
            render();
          }
        });
      });

      rootEl.querySelectorAll<HTMLButtonElement>('[data-adm-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tid = btn.dataset.admDel;
          if (!tid || !snap.isAdmin) return;
          try {
            await deleteCustomTest(tid);
            setNotice(`Removed ${tid} from Test Bank.`, 'ok');
            render();
          } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Failed to delete test item.', 'err');
            render();
          }
        });
      });
    }
  }

  function onGlobalKeyDown(e: KeyboardEvent): void {
    if (!rootEl || activeTab !== 'reading') return;
    if (!e.altKey) return;
    const test = READING_TESTS[readingTestIdx];
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      readingActiveQ = Math.min(test.questions.length, readingActiveQ + 1);
      render();
      document.getElementById(`ws-q-${readingActiveQ}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      readingActiveQ = Math.max(1, readingActiveQ - 1);
      render();
      document.getElementById(`ws-q-${readingActiveQ}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      applyReadingHighlight();
    }
  }

  return {
    mount(container: HTMLElement, initialTab?: string, opts?: WorkspaceMountOptions) {
      rootEl = container;
      const validTabs: WorkspaceTab[] = ['reading', 'listening', 'writing', 'speaking', 'progress', 'admin'];
      if (initialTab && validTabs.includes(initialTab as WorkspaceTab)) {
        activeTab = initialTab as WorkspaceTab;
      }

      // Sync exam focus & auto-select matching exam/section test when deep-linked from Profile or Progress
      if (opts?.exam && isValidExamId(opts.exam)) {
        progressFocusExam = opts.exam;
        setStoredFocusExam(opts.exam);
      } else {
        progressFocusExam = getStoredFocusExam();
      }

      if (opts && (opts.test || opts.exam || opts.section)) {
        if (activeTab === 'reading') {
          const idx = READING_TESTS.findIndex(
            (t) =>
              (opts.test && t.id === opts.test) ||
              (opts.exam && t.examId === opts.exam && (!opts.section || t.sectionKey === opts.section))
          );
          if (idx >= 0 && idx !== readingTestIdx) {
            readingTestIdx = idx;
            readingAnswers = {};
            readingFlags = {};
            readingCrossed = {};
            readingActiveQ = 1;
            readingSubmitted = false;
            readingSavedCloud = false;
            readingTimeLeft = READING_TESTS[idx].durationSec;
          }
        } else if (activeTab === 'listening') {
          const idx = LISTENING_TESTS.findIndex(
            (t) =>
              (opts.test && t.id === opts.test) ||
              (opts.exam && t.examId === opts.exam)
          );
          if (idx >= 0 && idx !== listeningTestIdx) {
            stopListeningPlayback();
            listeningTestIdx = idx;
            listeningAnswers = {};
            listeningSubmitted = false;
            listeningCueIdx = -1;
            listeningPlayCount = 0;
            listeningSavedCloud = false;
          }
        } else if (activeTab === 'writing') {
          const match = WRITING_PROMPTS.find(
            (p) =>
              (opts.test && p.id === opts.test) ||
              (opts.exam && p.examId === opts.exam)
          );
          if (match && match.id !== writingPromptId) {
            writingPromptId = match.id;
            writingTimeLeft = match.durationSec;
            writingResult = null;
            writingSavedCloud = false;
          }
        } else if (activeTab === 'speaking') {
          const idx = SPEAKING_TESTS.findIndex(
            (s) =>
              (opts.test && s.id === opts.test) ||
              (opts.exam && s.examId === opts.exam)
          );
          if (idx >= 0 && idx !== speakingTestIdx) {
            speakingTestIdx = idx;
            resetSpeakingExamState(false);
          }
        }
      }

      window.addEventListener('keydown', onGlobalKeyDown);
      window.addEventListener(EXAMINER_SETTINGS_EVENT, onExaminerSettingsUpdated);
      render();
    },
    unmount() {
      closeAllIeaflDropdowns(false);
      window.removeEventListener('keydown', onGlobalKeyDown);
      window.removeEventListener(EXAMINER_SETTINGS_EVENT, onExaminerSettingsUpdated);
      clearAllTimers();
      rootEl = null;
    },
    notifyCloudUpdate() {
      if (rootEl) render();
    },
    getTab() {
      return activeTab;
    },
  };
}
