import { requestGeminiTtsWav } from './examinerSettings';
import { transcribeAudioBlob, type LiveExamMode, type LiveVoiceName } from './liveSpeaking';

export interface TtsPlaybackHandle {
  stop: () => void;
  finished: Promise<void>;
}

export interface StageRecorderOptions {
  /** Seconds of continuous silence after the user has spoken before auto-finishing */
  silenceDelaySec: number;
  /** Whether silence auto-advance is enabled */
  autoAdvance: boolean;
  /** Minimum elapsed speaking seconds before silence auto-advance can fire */
  minSpeakGraceSec: number;
  /** Real-time mic amplitude (0..1) for 3D listening feedback & HUD meter */
  onLevel: (rms: number) => void;
  /** Called periodically while counting down silence (null when user is actively talking or hasn't started) */
  onSilenceCountdown: (remainingSec: number | null, totalSec: number) => void;
  /** Fired once speech is first detected */
  onSpeechDetected?: () => void;
  /** Optional seconds of zero speech before firing a check-in / pause offer callback */
  noSpeechCheckInSec?: number;
  /** Fired when no speech has been detected for noSpeechCheckInSec active seconds */
  onNoSpeechCheckIn?: () => void;
  /** Fired when silence threshold completes cleanly */
  onAutoSilenceComplete: () => void;
}

export interface StageRecorderController {
  stop: () => Promise<Blob | null>;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  setPaused: (paused: boolean) => void;
  isPaused: () => boolean;
  resetNoSpeechTimer: () => void;
}

export interface PregenClipItem {
  label: string;
  text: string;
}

export interface PregenProgressInfo {
  done: number;
  total: number;
  currentLabel: string;
  failedCount: number;
}

/**
 * Coordinates pre-generated Gemini 3.8 TTS clips (with real-time lip-sync analyser),
 * uninterrupted per-stage MediaRecorder capture with adaptive-noise-floor VAD silence detection,
 * true time-freeze pause/resume, and reliable background Gemini 3.5 Transcribe per stage.
 */
export function createSpeakingStageEngine() {
  let audioCtx: AudioContext | null = null;
  let activeSource: AudioBufferSourceNode | null = null;
  let activeExaminerRaf = 0;
  let activeAbort: AbortController | null = null;
  let persistentMicStream: MediaStream | null = null;
  let examinerPaused = false;

  // In-memory WAV cache for instant stage-to-stage transitions (key = voice|mode|text)
  const wavBufferCache = new Map<string, Promise<ArrayBuffer>>();

  function ensureAudioContext(): AudioContext {
    if (!audioCtx || audioCtx.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  }

  function fetchClip(
    text: string,
    voiceName: LiveVoiceName,
    examMode: LiveExamMode
  ): Promise<ArrayBuffer> {
    const key = `${voiceName}|${examMode}|${text.trim()}`;
    const existing = wavBufferCache.get(key);
    if (existing) return existing;

    const promise = requestGeminiTtsWav(text, voiceName, examMode)
      .catch(async (firstErr) => {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr ?? '');
        // Retry once after a short backoff if Gemini TTS hits transient rate-limit or network error
        if (/429|quota|rate|502|503|network|fetch/i.test(msg)) {
          await new Promise((r) => window.setTimeout(r, 700));
          return requestGeminiTtsWav(text, voiceName, examMode);
        }
        throw firstErr;
      })
      .catch((err) => {
        // Remove failed entry so retries can succeed later
        wavBufferCache.delete(key);
        throw err;
      });
    wavBufferCache.set(key, promise);
    return promise;
  }

  async function pregenerateAllClips(
    items: PregenClipItem[],
    voiceName: LiveVoiceName,
    examMode: LiveExamMode,
    onProgress?: (info: PregenProgressInfo) => void,
    signal?: AbortSignal
  ): Promise<{ done: number; total: number; failedCount: number }> {
    const cleanItems: PregenClipItem[] = [];
    const seenKeys = new Set<string>();
    for (const item of items) {
      const txt = item.text.trim();
      if (!txt) continue;
      const dedupeKey = `${voiceName}|${examMode}|${txt}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      cleanItems.push({ label: item.label, text: txt });
    }

    const total = cleanItems.length;
    let done = 0;
    let failedCount = 0;
    onProgress?.({
      done: 0,
      total,
      currentLabel: cleanItems[0]?.label || 'Examiner voice clips',
      failedCount: 0,
    });

    if (total === 0) {
      return { done: 0, total: 0, failedCount: 0 };
    }

    let cursor = 0;
    const concurrency = 1;

    const worker = async () => {
      while (cursor < total) {
        if (signal?.aborted) return;
        const idx = cursor++;
        const entry = cleanItems[idx];
        onProgress?.({
          done,
          total,
          currentLabel: entry.label,
          failedCount,
        });
        try {
          await fetchClip(entry.text, voiceName, examMode);
        } catch {
          failedCount++;
        }
        if (signal?.aborted) return;
        done++;
        onProgress?.({
          done,
          total,
          currentLabel: cleanItems[Math.min(cursor, total - 1)]?.label || entry.label,
          failedCount,
        });
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return { done, total, failedCount };
  }

  function setExaminerPaused(paused: boolean): void {
    examinerPaused = Boolean(paused);
    if (audioCtx && audioCtx.state !== 'closed') {
      if (examinerPaused && audioCtx.state === 'running') {
        void audioCtx.suspend().catch(() => {});
      } else if (!examinerPaused && audioCtx.state === 'suspended') {
        void audioCtx.resume().catch(() => {});
      }
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (examinerPaused) {
          window.speechSynthesis.pause();
        } else {
          window.speechSynthesis.resume();
        }
      } catch {
        // ignore
      }
    }
  }

  function stopExaminerPlayback(): void {
    examinerPaused = false;
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
    if (activeExaminerRaf) {
      window.cancelAnimationFrame(activeExaminerRaf);
      activeExaminerRaf = 0;
    }
    if (activeSource) {
      try {
        activeSource.onended = null;
        activeSource.stop();
        activeSource.disconnect();
      } catch {
        // ignore already stopped
      }
      activeSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  async function speakExaminerPrompt(
    text: string,
    voiceName: LiveVoiceName,
    examMode: LiveExamMode,
    onExaminerLevel: (rms: number) => void
  ): Promise<{ usedFallback: boolean; error?: string }> {
    stopExaminerPlayback();
    const abortCtrl = new AbortController();
    activeAbort = abortCtrl;

    try {
      const wavData = await fetchClip(text, voiceName, examMode);
      if (abortCtrl.signal.aborted) {
        onExaminerLevel(0);
        return { usedFallback: false };
      }

      const ctx = ensureAudioContext();
      // decodeAudioData detaches its input buffer in some browsers, so pass a slice
      const decoded = await ctx.decodeAudioData(wavData.slice(0));
      if (abortCtrl.signal.aborted) {
        onExaminerLevel(0);
        return { usedFallback: false };
      }

      const source = ctx.createBufferSource();
      source.buffer = decoded;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      activeSource = source;

      const timeData = new Float32Array(analyser.fftSize);
      const pumpLipSync = () => {
        if (!activeSource || abortCtrl.signal.aborted) {
          onExaminerLevel(0);
          return;
        }
        if (!examinerPaused) {
          analyser.getFloatTimeDomainData(timeData);
          let sum = 0;
          for (let i = 0; i < timeData.length; i++) {
            sum += timeData[i] * timeData[i];
          }
          const rms = Math.sqrt(sum / timeData.length);
          onExaminerLevel(Math.min(1, rms * 4.4));
        }
        activeExaminerRaf = window.requestAnimationFrame(pumpLipSync);
      };

      await new Promise<void>((resolve) => {
        source.onended = () => {
          if (activeSource === source) activeSource = null;
          if (activeExaminerRaf) {
            window.cancelAnimationFrame(activeExaminerRaf);
            activeExaminerRaf = 0;
          }
          onExaminerLevel(0);
          resolve();
        };
        abortCtrl.signal.addEventListener(
          'abort',
          () => {
            onExaminerLevel(0);
            resolve();
          },
          { once: true }
        );
        source.start(0);
        pumpLipSync();
      });

      return { usedFallback: false };
    } catch (err) {
      if (abortCtrl.signal.aborted) {
        onExaminerLevel(0);
        return { usedFallback: false };
      }
      const errMsg = err instanceof Error ? err.message : 'TTS request failed.';
      // Graceful browser speechSynthesis fallback so the exam level flow never deadlocks
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        await new Promise<void>((resolve) => {
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-GB';
            u.rate = 0.98;
            let synthTick = 0;
            const pulseId = window.setInterval(() => {
              if (examinerPaused) return;
              synthTick += 0.25;
              onExaminerLevel(0.28 + Math.abs(Math.sin(synthTick * 5.2)) * 0.42);
            }, 90);
            const done = () => {
              window.clearInterval(pulseId);
              onExaminerLevel(0);
              resolve();
            };
            u.onend = done;
            u.onerror = done;
            abortCtrl.signal.addEventListener('abort', done, { once: true });
            window.speechSynthesis.speak(u);
          } catch {
            onExaminerLevel(0);
            resolve();
          }
        });
        return { usedFallback: true, error: errMsg };
      }
      onExaminerLevel(0);
      return { usedFallback: true, error: errMsg };
    }
  }

  async function ensureMicrophone(): Promise<MediaStream> {
    if (
      persistentMicStream &&
      persistentMicStream.getAudioTracks().some((t) => t.readyState === 'live')
    ) {
      return persistentMicStream;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.');
    }
    try {
      persistentMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      return persistentMicStream;
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name || '') : '';
      const rawMsg = err instanceof Error ? err.message : String(err ?? '');
      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        /permission denied|not allowed|denied/i.test(rawMsg)
      ) {
        throw new Error('Microphone access was blocked by the browser (Permission denied).');
      }
      if (name === 'NotFoundError' || /not found|no device/i.test(rawMsg)) {
        throw new Error('No microphone input device was detected.');
      }
      throw new Error(rawMsg || 'Could not access microphone.');
    }
  }

  function releaseMicrophone(): void {
    if (persistentMicStream) {
      persistentMicStream.getTracks().forEach((t) => t.stop());
      persistentMicStream = null;
    }
  }

  async function startStageRecording(
    opts: StageRecorderOptions
  ): Promise<StageRecorderController> {
    const stream = await ensureMicrophone();
    const ctx = ensureAudioContext();

    // Ensure audio tracks start unmuted
    stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });

    const preferredMime =
      typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

    const recorder = preferredMime
      ? new MediaRecorder(stream, { mimeType: preferredMime })
      : new MediaRecorder(stream);

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };

    const sourceNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.65;
    sourceNode.connect(analyser);

    const timeData = new Float32Array(analyser.fftSize);
    let activeElapsedMs = 0;
    let ambientNoiseSum = 0;
    let ambientSamples = 0;
    let noiseFloor = 0.014;
    let speechAccumMs = 0;
    let hasSpoken = false;
    let silenceAccumMs = 0;
    let noSpeechAccumMs = 0;
    let lastFrameMs = performance.now();
    let muted = false;
    let paused = false;
    let stopped = false;
    let autoTriggered = false;
    let rafId = 0;
    let stopPromise: Promise<Blob | null> | null = null;

    // Wait 2.0s of continuous silence before showing the countdown bar so natural pauses aren't distracting
    const SILENCE_HUD_REVEAL_SEC = Math.min(2.0, Math.max(1.2, opts.silenceDelaySec * 0.3));

    const cleanupAudioGraph = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      try {
        sourceNode.disconnect();
        analyser.disconnect();
      } catch {
        // ignore
      }
      opts.onLevel(0);
      opts.onSilenceCountdown(null, opts.silenceDelaySec);
    };

    const monitorVad = () => {
      if (stopped) return;
      const now = performance.now();
      const dtMs = Math.min(120, Math.max(0, now - lastFrameMs));
      lastFrameMs = now;

      if (paused) {
        rafId = window.requestAnimationFrame(monitorVad);
        return;
      }

      activeElapsedMs += dtMs;

      analyser.getFloatTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        sumSq += timeData[i] * timeData[i];
      }
      const rawRms = muted ? 0 : Math.sqrt(sumSq / timeData.length);
      const visualLevel = Math.min(1, rawRms * 5.2);
      opts.onLevel(visualLevel);

      const elapsedSec = activeElapsedMs / 1000;

      // Calibrate ambient noise floor during the first 350ms
      if (elapsedSec < 0.35 && !muted) {
        ambientNoiseSum += rawRms;
        ambientSamples++;
        if (ambientSamples > 0) {
          noiseFloor = Math.min(0.045, Math.max(0.01, ambientNoiseSum / ambientSamples));
        }
      }

      const speechThreshold = Math.max(0.018, noiseFloor * 2.15);

      if (!muted && rawRms >= speechThreshold) {
        speechAccumMs += dtMs;
        silenceAccumMs = 0;
        noSpeechAccumMs = 0;
        opts.onSilenceCountdown(null, opts.silenceDelaySec);
        if (!hasSpoken && speechAccumMs >= 380) {
          hasSpoken = true;
          opts.onSpeechDetected?.();
        }
      } else if (
        opts.autoAdvance &&
        !muted &&
        hasSpoken &&
        elapsedSec >= opts.minSpeakGraceSec
      ) {
        silenceAccumMs += dtMs;
        const silentSec = silenceAccumMs / 1000;
        const remaining = Math.max(0, opts.silenceDelaySec - silentSec);
        if (silentSec >= SILENCE_HUD_REVEAL_SEC) {
          opts.onSilenceCountdown(remaining, opts.silenceDelaySec);
        } else {
          opts.onSilenceCountdown(null, opts.silenceDelaySec);
        }
        if (remaining <= 0 && !autoTriggered) {
          autoTriggered = true;
          opts.onAutoSilenceComplete();
          return;
        }
      } else {
        silenceAccumMs = 0;
        opts.onSilenceCountdown(null, opts.silenceDelaySec);
        // Track continuous pre-speech inactivity so the examiner can check in & offer to pause
        if (
          !muted &&
          !hasSpoken &&
          opts.noSpeechCheckInSec &&
          opts.noSpeechCheckInSec > 0 &&
          opts.onNoSpeechCheckIn
        ) {
          noSpeechAccumMs += dtMs;
          if (noSpeechAccumMs >= opts.noSpeechCheckInSec * 1000) {
            noSpeechAccumMs = 0;
            opts.onNoSpeechCheckIn();
          }
        }
      }

      rafId = window.requestAnimationFrame(monitorVad);
    };

    // Request timeslice chunks every 500ms so even short turns never lose audio frames
    recorder.start(500);
    monitorVad();

    return {
      stop(): Promise<Blob | null> {
        if (stopPromise) return stopPromise;
        stopped = true;
        cleanupAudioGraph();

        stopPromise = new Promise<Blob | null>((resolve) => {
          if (recorder.state === 'inactive') {
            const blob =
              chunks.length > 0
                ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
                : null;
            resolve(blob && blob.size > 0 ? blob : null);
            return;
          }
          recorder.onstop = () => {
            const blob =
              chunks.length > 0
                ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
                : null;
            resolve(blob && blob.size > 0 ? blob : null);
          };
          recorder.onerror = () => resolve(null);
          try {
            recorder.stop();
          } catch {
            resolve(null);
          }
        });
        return stopPromise;
      },
      setMuted(nextMuted: boolean) {
        muted = nextMuted;
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !nextMuted && !paused;
        });
        if (nextMuted) {
          silenceAccumMs = 0;
          opts.onSilenceCountdown(null, opts.silenceDelaySec);
        }
      },
      isMuted() {
        return muted;
      },
      setPaused(nextPaused: boolean) {
        if (stopped || paused === nextPaused) return;
        paused = nextPaused;
        lastFrameMs = performance.now();
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !paused && !muted;
        });
        try {
          if (paused && recorder.state === 'recording') {
            recorder.pause();
          } else if (!paused && recorder.state === 'paused') {
            recorder.resume();
          }
        } catch {
          // Some browsers skip MediaRecorder pause gracefully; track gating still prevents capture
        }
        if (paused) {
          opts.onLevel(0);
        }
      },
      isPaused() {
        return paused;
      },
      resetNoSpeechTimer() {
        noSpeechAccumMs = 0;
      },
    };
  }

  async function transcribeStageBlob(
    blob: Blob,
    stageLabel: string
  ): Promise<string> {
    if (!blob || blob.size < 400) return '';
    return transcribeAudioBlob(blob, stageLabel);
  }

  function dispose(): void {
    stopExaminerPlayback();
    releaseMicrophone();
    if (audioCtx && audioCtx.state !== 'closed') {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  return {
    pregenerateAllClips,
    speakExaminerPrompt,
    setExaminerPaused,
    stopExaminerPlayback,
    ensureMicrophone,
    releaseMicrophone,
    startStageRecording,
    transcribeStageBlob,
    dispose,
  };
}
