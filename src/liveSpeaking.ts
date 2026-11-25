export type LiveVoiceName = 'Zephyr' | 'Kore' | 'Charon' | 'Puck' | 'Fenrir';
export type LiveExamMode = 'ielts' | 'nec' | 'hsg';

export interface LiveSpeakingCallbacks {
  onStatus: (state: 'connecting' | 'live' | 'disconnected' | 'error', detail?: string) => void;
  onAudioLevels: (examinerRms: number, studentRms: number) => void;
  onExaminerSpeakingChange: (speaking: boolean) => void;
  onInputTranscript: (chunk: string) => void;
  onOutputTranscript: (chunk: string) => void;
  onTurnComplete: () => void;
}

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000 || inputSampleRate <= 0) return input;
  const ratio = inputSampleRate / 16000;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  let offsetOut = 0;
  let offsetIn = 0;
  while (offsetOut < outLength) {
    const nextOffsetIn = Math.min(input.length, Math.round((offsetOut + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let i = offsetIn; i < nextOffsetIn; i++) {
      sum += input[i];
      count++;
    }
    out[offsetOut] = count > 0 ? sum / count : 0;
    offsetOut++;
    offsetIn = nextOffsetIn;
  }
  return out;
}

function float32ToPcm16Base64(float32: Float32Array, sampleRate: number): string {
  const pcmFloat = sampleRate !== 16000 ? downsampleTo16k(float32, sampleRate) : float32;
  const buf = new ArrayBuffer(pcmFloat.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < pcmFloat.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(new ArrayBuffer(len));
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(new ArrayBuffer(sampleCount * 4));
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export interface LiveSpeakingClient {
  start: (opts: {
    examMode: LiveExamMode;
    turnLabel: string;
    prompt: string;
    voiceName: LiveVoiceName;
  }) => Promise<void>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  isActive: () => boolean;
  sendTextNudge: (text: string) => void;
}

export function createLiveSpeakingClient(cb: LiveSpeakingCallbacks): LiveSpeakingClient {
  let ws: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let inputCtx: AudioContext | null = null;
  let outputCtx: AudioContext | null = null;
  let scriptNode: ScriptProcessorNode | null = null;
  let outAnalyser: AnalyserNode | null = null;
  let inAnalyser: AnalyserNode | null = null;
  let meterRafId = 0;
  let pingTimerId = 0;
  let active = false;
  let intentionalStop = false;
  let receivedServerError = false;
  let muted = false;
  let nextStartTime = 0;
  let activeSources: AudioBufferSourceNode[] = [];
  let examinerCurrentlySpeaking = false;

  const outData = new Uint8Array(new ArrayBuffer(256));
  const inData = new Uint8Array(new ArrayBuffer(256));

  function computeRms(analyser: AnalyserNode | null, buf: Uint8Array<ArrayBuffer>): number {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(buf);
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sumSq += v * v;
    }
    return Math.min(1, Math.sqrt(sumSq / buf.length) * 2.8);
  }

  function clearPlaybackQueue(): void {
    for (const src of activeSources) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    activeSources = [];
    if (outputCtx) {
      nextStartTime = outputCtx.currentTime;
    }
    if (examinerCurrentlySpeaking) {
      examinerCurrentlySpeaking = false;
      cb.onExaminerSpeakingChange(false);
    }
  }

  function schedulePcm24k(base64Audio: string): void {
    if (!outputCtx || !outAnalyser) return;
    if (outputCtx.state === 'suspended') {
      void outputCtx.resume();
    }
    const samples = base64Pcm16ToFloat32(base64Audio);
    if (samples.length === 0) return;

    const buffer = outputCtx.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);

    const src = outputCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(outAnalyser);

    const now = outputCtx.currentTime;
    if (nextStartTime < now + 0.02) {
      nextStartTime = now + 0.03;
    }
    src.start(nextStartTime);
    nextStartTime += buffer.duration;

    activeSources.push(src);
    if (!examinerCurrentlySpeaking) {
      examinerCurrentlySpeaking = true;
      cb.onExaminerSpeakingChange(true);
    }

    src.onended = () => {
      activeSources = activeSources.filter((s) => s !== src);
      if (activeSources.length === 0 && examinerCurrentlySpeaking) {
        examinerCurrentlySpeaking = false;
        cb.onExaminerSpeakingChange(false);
      }
    };
  }

  function startMeterLoop(): void {
    const loop = (): void => {
      if (!active) return;
      const exRms = computeRms(outAnalyser, outData);
      const stRms = muted ? 0 : computeRms(inAnalyser, inData);
      cb.onAudioLevels(exRms, stRms);
      meterRafId = window.requestAnimationFrame(loop);
    };
    meterRafId = window.requestAnimationFrame(loop);
  }

  function cleanup(): void {
    active = false;
    window.cancelAnimationFrame(meterRafId);
    window.clearInterval(pingTimerId);
    pingTimerId = 0;
    clearPlaybackQueue();

    if (scriptNode) {
      try {
        scriptNode.disconnect();
      } catch {
        // ignore
      }
      scriptNode.onaudioprocess = null;
      scriptNode = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (inputCtx) {
      void inputCtx.close().catch(() => undefined);
      inputCtx = null;
    }
    if (outputCtx) {
      void outputCtx.close().catch(() => undefined);
      outputCtx = null;
    }
    outAnalyser = null;
    inAnalyser = null;

    if (ws) {
      const sock = ws;
      ws = null;
      sock.onopen = null;
      sock.onmessage = null;
      sock.onerror = null;
      sock.onclose = null;
      try {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: 'stop' }));
        }
        sock.close();
      } catch {
        // ignore
      }
    }
    cb.onAudioLevels(0, 0);
    cb.onExaminerSpeakingChange(false);
  }

  return {
    async start(opts) {
      intentionalStop = false;
      receivedServerError = false;
      cleanup();
      cb.onStatus('connecting', 'Requesting microphone & connecting to Gemini 3.8 Live…');

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      // Create & resume playback context right inside the user gesture before async awaits
      try {
        outputCtx = new AudioCtx({ sampleRate: 24000 });
        if (outputCtx.state === 'suspended') {
          void outputCtx.resume();
        }
      } catch {
        outputCtx = new AudioCtx();
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        cleanup();
        cb.onStatus(
          'error',
          'Microphone permission was denied or unavailable. Please allow microphone access to start the live 3D voice interview.'
        );
        return;
      }

      try {
        inputCtx = new AudioCtx({ sampleRate: 16000 });
      } catch {
        inputCtx = new AudioCtx();
      }
      if (inputCtx.state === 'suspended') {
        void inputCtx.resume();
      }
      if (outputCtx && outputCtx.state === 'suspended') {
        void outputCtx.resume();
      }
      nextStartTime = outputCtx.currentTime;

      outAnalyser = outputCtx.createAnalyser();
      outAnalyser.fftSize = 512;
      outAnalyser.connect(outputCtx.destination);

      const micSource = inputCtx.createMediaStreamSource(mediaStream);
      inAnalyser = inputCtx.createAnalyser();
      inAnalyser.fftSize = 512;
      micSource.connect(inAnalyser);

      scriptNode = inputCtx.createScriptProcessor(4096, 1, 1);
      micSource.connect(scriptNode);
      scriptNode.connect(inputCtx.destination);

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/api/live-speaking`;
      ws = new WebSocket(wsUrl);

      let opened = false;
      const connectTimeout = window.setTimeout(() => {
        if (!opened && ws && ws.readyState === WebSocket.CONNECTING) {
          cb.onStatus('error', 'Live speaking server connection timed out. Please try again.');
          cleanup();
        }
      }, 12000);

      ws.onopen = () => {
        opened = true;
        window.clearTimeout(connectTimeout);
        active = true;
        ws?.send(
          JSON.stringify({
            type: 'start',
            examMode: opts.examMode,
            turnLabel: opts.turnLabel,
            prompt: opts.prompt,
            voiceName: opts.voiceName,
          })
        );
        pingTimerId = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 18000);
      };

      scriptNode.onaudioprocess = (ev) => {
        if (!active || muted || !ws || ws.readyState !== WebSocket.OPEN || !inputCtx) return;
        const channel = ev.inputBuffer.getChannelData(0);
        const base64 = float32ToPcm16Base64(channel, inputCtx.sampleRate);
        ws.send(JSON.stringify({ type: 'audio', data: base64 }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type?: string;
            data?: string;
            text?: string;
            message?: string;
            reason?: string;
            voiceName?: string;
          };
          if (msg.type === 'pong') return;
          if (msg.type === 'ready') {
            cb.onStatus('live', `Connected (${msg.voiceName || opts.voiceName}) · Speak naturally`);
            startMeterLoop();
            ws?.send(
              JSON.stringify({
                type: 'text',
                text: `Please greet the candidate warmly and ask the opening question for ${opts.turnLabel}: "${opts.prompt}"`,
              })
            );
          } else if (msg.type === 'audio' && msg.data) {
            schedulePcm24k(msg.data);
          } else if (msg.type === 'interrupted') {
            clearPlaybackQueue();
          } else if (msg.type === 'inputTranscript' && msg.text) {
            cb.onInputTranscript(msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            cb.onOutputTranscript(msg.text);
          } else if (msg.type === 'turnComplete') {
            cb.onTurnComplete();
          } else if (msg.type === 'error') {
            receivedServerError = true;
            cb.onStatus('error', msg.message || 'Live voice session encountered an error.');
            cleanup();
          } else if (msg.type === 'closed') {
            if (active && !intentionalStop && !receivedServerError) {
              const detail = msg.reason
                ? `Live voice interview ended (${msg.reason}).`
                : 'Live voice interview ended.';
              cb.onStatus('disconnected', detail);
              cleanup();
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        window.clearTimeout(connectTimeout);
        if (intentionalStop || receivedServerError) return;
        cb.onStatus(
          'error',
          'Could not reach the live speaking WebSocket server. Please reload or try again in a moment.'
        );
        cleanup();
      };

      ws.onclose = (ev) => {
        window.clearTimeout(connectTimeout);
        if (intentionalStop || receivedServerError) return;
        if (!opened) {
          cb.onStatus(
            'error',
            `Live speaking connection closed before ready (code ${ev.code}). Please try again.`
          );
          cleanup();
        } else if (active) {
          cb.onStatus('disconnected', 'Live voice interview ended.');
          cleanup();
        }
      };
    },

    stop() {
      intentionalStop = true;
      cleanup();
      cb.onStatus('disconnected', 'Live session stopped.');
    },

    setMuted(next: boolean) {
      muted = next;
    },

    isMuted() {
      return muted;
    },

    isActive() {
      return active;
    },

    sendTextNudge(text: string) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'text', text }));
      }
    },
  };
}

export async function transcribeAudioBlob(blob: Blob, contextHint?: string): Promise<string> {
  const arrayBuf = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const audioBase64 = btoa(binary);

  const res = await fetch('/api/gemini/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      contextHint,
    }),
  });
  let data: { text?: string; error?: string } = {};
  try {
    data = (await res.json()) as { text?: string; error?: string };
  } catch {
    if (!res.ok) {
      throw new Error(`Gemini transcription failed (HTTP ${res.status}).`);
    }
  }
  if (!res.ok) {
    throw new Error(data.error || `Gemini transcription failed (HTTP ${res.status}).`);
  }
  return (data.text || '').trim();
}
