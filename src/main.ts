import type { Unsubscribe } from 'firebase/auth';
import {
  listenAuth,
  signInWithGoogle,
  signOutUser,
  checkIsAdmin,
  ensureUserProfile,
  updateUserGoals,
  deleteAttempt,
  syncRoadmapSteps,
  subscribeAttempts,
  subscribeTestBank,
  type UserProfile,
} from './firebase';
import { createWorkspaceController, type CloudSnapshot } from './workspace';
import { initStudyAgent } from './studyAgent';
import { initFooterLogoShader } from './footerLogoShader';
import { enhanceIeaflSelects, closeAllIeaflDropdowns } from './ieaflSelect';
import { BUILTIN_AVATARS } from './examiner3d';
import {
  EXAMINER_VOICES,
  getExaminerSettings,
  saveExaminerSettings,
  selectBuiltInAvatarFromSettings,
  uploadCustomAvatarFromSettings,
  setCustomAvatarUrlFromSettings,
  previewExaminerVoice,
  stopVoicePreview,
} from './examinerSettings';
import {
  EXAM_CONFIGS,
  EXAM_ORDER,
  classifyAttempt,
  computeExamForecast,
  getExamGoal,
  saveExamGoalLocal,
  isValidExamId,
} from './examScoring';

const cloudState: CloudSnapshot = {
  authReady: false,
  user: null,
  isAdmin: false,
  profile: null,
  attempts: [],
  testBank: [],
  authError: null,
};

let unsubAttempts: Unsubscribe | null = null;
let unsubTestBank: Unsubscribe | null = null;

function stopSubscriptions(): void {
  if (unsubAttempts) {
    unsubAttempts();
    unsubAttempts = null;
  }
  if (unsubTestBank) {
    unsubTestBank();
    unsubTestBank = null;
  }
}

function readLocalRoadmapSteps(): string[] {
  try {
    const raw = window.localStorage.getItem('ieafl.roadmapSteps');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderHeaderAuthControls(): void {
  const desktopBtn = document.getElementById('auth-btn-desktop');
  const mobileBtn = document.getElementById('auth-btn-mobile');
  const targets = [desktopBtn, mobileBtn].filter(Boolean) as HTMLButtonElement[];
  for (const btn of targets) {
    if (!cloudState.authReady) {
      btn.textContent = '(Auth…)';
      btn.disabled = true;
    } else if (cloudState.user) {
      const firstName = (cloudState.profile?.displayName || cloudState.user.displayName || 'Account')
        .trim()
        .split(/\s+/)[0]
        .slice(0, 14);
      btn.textContent = `(${firstName} · Profile)`;
      btn.disabled = false;
      btn.setAttribute('aria-label', `Signed in as ${cloudState.user.email || firstName}. Open your profile and monthly band forecast.`);
    } else {
      btn.textContent = '(Google Sign-In)';
      btn.disabled = false;
      btn.setAttribute('aria-label', 'Sign in exclusively with Google via Firebase');
    }
  }
}

const workspaceCtrl = createWorkspaceController(
  () => cloudState,
  (updatedProfile: UserProfile) => {
    cloudState.profile = updatedProfile;
    renderHeaderAuthControls();
    workspaceCtrl.notifyCloudUpdate(cloudState);
    window.dispatchEvent(new CustomEvent('ieafl:cloud-update', { detail: cloudState }));
  }
);

function dispatchCloudChanged(): void {
  renderHeaderAuthControls();
  workspaceCtrl.notifyCloudUpdate(cloudState);
  window.dispatchEvent(new CustomEvent('ieafl:cloud-update', { detail: cloudState }));
}

listenAuth(async (user) => {
  stopSubscriptions();
  cloudState.user = user;
  cloudState.authError = null;
  cloudState.attempts = [];
  cloudState.testBank = [];
  cloudState.profile = null;
  cloudState.isAdmin = false;

  if (!user) {
    cloudState.authReady = true;
    dispatchCloudChanged();
    return;
  }

  try {
    const [adminFlag, profile] = await Promise.all([
      checkIsAdmin(user),
      ensureUserProfile(user, readLocalRoadmapSteps()),
    ]);
    cloudState.isAdmin = adminFlag;
    cloudState.profile = profile;
    cloudState.authReady = true;

    // Mirror cloud roadmap steps into localStorage so Study Plan stays synced
    try {
      window.localStorage.setItem('ieafl.roadmapSteps', JSON.stringify(profile.completedRoadmapSteps));
    } catch {
      // ignore storage failure
    }

    dispatchCloudChanged();

    unsubAttempts = subscribeAttempts(
      user.uid,
      (attempts) => {
        cloudState.attempts = attempts;
        dispatchCloudChanged();
      },
      (err) => {
        cloudState.authError = err.message;
        dispatchCloudChanged();
      }
    );

    unsubTestBank = subscribeTestBank(
      adminFlag,
      (items) => {
        cloudState.testBank = items;
        dispatchCloudChanged();
      },
      (err) => {
        cloudState.authError = err.message;
        dispatchCloudChanged();
      }
    );
  } catch (err) {
    cloudState.authReady = true;
    cloudState.authError = err instanceof Error ? err.message : 'Firebase session sync failed.';
    dispatchCloudChanged();
  }
});

async function handleHeaderAuthClick(): Promise<void> {
  if (!cloudState.authReady) return;
  try {
    if (cloudState.user) {
      window.location.hash = '#/profile';
    } else {
      await signInWithGoogle();
      window.location.hash = '#/profile';
    }
  } catch (err) {
    cloudState.authError = err instanceof Error ? err.message : 'Google Sign-In error.';
    dispatchCloudChanged();
  }
}

document.getElementById('auth-btn-desktop')?.addEventListener('click', () => void handleHeaderAuthClick());
document.getElementById('auth-btn-mobile')?.addEventListener('click', () => void handleHeaderAuthClick());

declare global {
  interface Window {
    IEAFL_CLOUD?: {
      getState: () => CloudSnapshot;
      signInWithGoogle: typeof signInWithGoogle;
      signOut: typeof signOutUser;
      syncRoadmapSteps: (steps: string[]) => Promise<void>;
      updateUserGoals: (targetBand: number, examDate: string, displayName?: string) => Promise<void>;
      deleteAttempt: (attemptId: string) => Promise<void>;
    };
    IEAFL_WORKSPACE?: typeof workspaceCtrl;
    IEAFL_EXAMINER_SETTINGS?: {
      BUILTIN_AVATARS: typeof BUILTIN_AVATARS;
      EXAMINER_VOICES: typeof EXAMINER_VOICES;
      get: typeof getExaminerSettings;
      save: typeof saveExaminerSettings;
      selectBuiltInAvatar: typeof selectBuiltInAvatarFromSettings;
      uploadCustomAvatar: typeof uploadCustomAvatarFromSettings;
      setCustomAvatarUrl: typeof setCustomAvatarUrlFromSettings;
      previewVoice: typeof previewExaminerVoice;
      stopVoicePreview: typeof stopVoicePreview;
    };
    IEAFL_EXAM_SCORING?: {
      EXAM_CONFIGS: typeof EXAM_CONFIGS;
      EXAM_ORDER: typeof EXAM_ORDER;
      classifyAttempt: typeof classifyAttempt;
      computeExamForecast: typeof computeExamForecast;
      getExamGoal: typeof getExamGoal;
      saveExamGoalLocal: typeof saveExamGoalLocal;
      isValidExamId: typeof isValidExamId;
    };
  }
}

window.IEAFL_EXAM_SCORING = {
  EXAM_CONFIGS,
  EXAM_ORDER,
  classifyAttempt,
  computeExamForecast,
  getExamGoal,
  saveExamGoalLocal,
  isValidExamId,
};

window.IEAFL_EXAMINER_SETTINGS = {
  BUILTIN_AVATARS,
  EXAMINER_VOICES,
  get: getExaminerSettings,
  save: saveExaminerSettings,
  selectBuiltInAvatar: selectBuiltInAvatarFromSettings,
  uploadCustomAvatar: uploadCustomAvatarFromSettings,
  setCustomAvatarUrl: setCustomAvatarUrlFromSettings,
  previewVoice: previewExaminerVoice,
  stopVoicePreview,
};

window.IEAFL_CLOUD = {
  getState: () => cloudState,
  signInWithGoogle,
  signOut: signOutUser,
  async syncRoadmapSteps(steps: string[]) {
    if (!cloudState.user) return;
    await syncRoadmapSteps(cloudState.user.uid, steps);
    if (cloudState.profile) {
      cloudState.profile = { ...cloudState.profile, completedRoadmapSteps: [...steps].slice(0, 24) };
      dispatchCloudChanged();
    }
  },
  async updateUserGoals(targetBand: number, examDate: string, displayName?: string) {
    if (!cloudState.user) return;
    const resolvedName =
      (displayName && displayName.trim()) ||
      cloudState.profile?.displayName ||
      cloudState.user.displayName ||
      'Learner';
    await updateUserGoals(cloudState.user.uid, {
      targetBand,
      examDate,
      displayName: resolvedName,
    });
    if (cloudState.profile) {
      cloudState.profile = {
        ...cloudState.profile,
        displayName: resolvedName,
        targetBand,
        examDate,
      };
      dispatchCloudChanged();
    }
  },
  async deleteAttempt(attemptId: string) {
    if (!cloudState.user) return;
    await deleteAttempt(cloudState.user.uid, attemptId);
  },
};

window.IEAFL_WORKSPACE = workspaceCtrl;

// Notify inline SPA if workspace is already mounted on load
dispatchCloudChanged();

// Mount global IEAFL Gemini Study Agent (Google Search grounded + right-click selection help)
initStudyAgent();

// Mount WebGL GLSL Pac-Man chase hover shader on the footer IEAFL wordmark
initFooterLogoShader();

// Stylize any native <select> elements on initial non-workspace views & route changes
enhanceIeaflSelects(document);
window.addEventListener('hashchange', () => {
  closeAllIeaflDropdowns(false);
  window.setTimeout(() => enhanceIeaflSelects(document), 0);
});
