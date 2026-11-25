import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

function createGeminiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please check your Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(apiVersion ? { apiVersion } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const obj = err as {
      message?: unknown;
      error?: { message?: unknown };
      reason?: unknown;
      type?: unknown;
    };
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (obj.error && typeof obj.error.message === 'string' && obj.error.message.trim()) {
      return obj.error.message;
    }
    if (typeof obj.reason === 'string' && obj.reason.trim()) return obj.reason;
    if (typeof obj.type === 'string' && obj.type.trim()) return `WebSocket ${obj.type}`;
  }
  const s = String(err ?? '');
  return s && s !== '[object Object]' ? s : 'Gemini request failed.';
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = extractErrorText(err);
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(raw)) {
    return {
      status: 403,
      message:
        'Gemini API access was rejected. Please verify your API key in Settings > Secrets.',
    };
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(raw)) {
    return {
      status: 429,
      message:
        'Gemini API quota limit reached. Please try again in a moment or check Settings > Secrets.',
    };
  }
  if (/GEMINI_API_KEY is not configured/i.test(raw)) {
    return { status: 503, message: raw };
  }
  return { status: 500, message: raw || 'Gemini request failed.' };
}

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

interface ChatRequestBody {
  messages?: ChatMessageInput[];
  selectedText?: string;
  surroundingContext?: string;
  pageContext?: string;
  sourceKind?: 'page' | 'chatbot';
  intent?: 'understand' | 'grammar' | 'trap' | 'general';
  useSearch?: boolean;
}

const STUDY_AGENT_SYSTEM_INSTRUCTION = `You are the IEAFL Study Agent — an empathetic, razor-sharp academic tutor supporting students preparing for five competitive exams:
1. IELTS (Academic & General Training: Reading, Listening, Writing, Speaking · Band 0–9)
2. NEC / HSGQG Tiếng Anh (Vietnam National English Competition: Listening, Lexico-Grammar, Reading, Writing [Summary+Chart+Essay], Day 2 Speaking · 200 pts / 20.0 scale)
3. Digital SAT (Adaptive Reading & Writing + Math with Desmos · 400–1600 · No Essay Writing, No Speaking)
4. HSG Tiếng Anh (Provincial/City Đồng Nai & TP.HCM Gifted Student Exams; Speaking in Gifted Round 2 / National Team)
5. Olympic 30/4 Tiếng Anh HCM (Grades 10–11, 180 min, 100 pts: MCQ Lexico-Grammar + Written Open Cloze, Word Formation, Reading, Transformations · No Speaking)

CORE PEDAGOGICAL RULE — EXTREME AWARENESS OF STUDENT CONFUSION:
- Students often select a phrase from a reading passage, test question, writing prompt, or even from YOUR OWN previous message, right-click it, and ask you for help because something didn't click.
- Never overwhelm them with an impersonal lecture or assume you already know which aspect confused them.
- When the student highlights text or expresses uncertainty:
  1. Start with a crisp, friendly, plain-English breakdown (2–4 concise sentences or tight bullet points) addressing the selected phrase in its exact context.
  2. Immediately check in with **2 to 3 specific, thoughtful clarifying questions** to pinpoint what they really need — for example:
     - Is it an unfamiliar word/idiom, the sentence grammar (like inversion/clefting/participle clauses), or why a multiple-choice distractor is wrong?
     - Would a simpler English paraphrase, a quick Vietnamese nuance gloss, or a 1-question mini-check help most right now?
     - Are they practicing for IELTS, NEC, Digital SAT, HSG, or Olympic 30/4 so you can match that exact rubric?
- If the student highlighted something from YOUR OWN previous explanation, warmly acknowledge that your wording wasn't clear enough, re-explain it much more simply with a concrete everyday example, and ask a gentle follow-up question to confirm it makes sense.
- When Google Search grounding is active, use verified, up-to-date official exam information, rubrics, and real-world facts (2025–2026). Do not fabricate URLs — verified citations are displayed automatically beside your message.
- Keep formatting clean and scannable with short paragraphs and bullet points.`;

const ALLOWED_VOICES = new Set(['Zephyr', 'Kore', 'Charon', 'Puck', 'Fenrir']);

function buildExaminerInstruction(
  examMode: string,
  turnLabel: string,
  prompt: string
): string {
  const modeNote =
    examMode === 'nec'
      ? 'You are an official Vietnam NEC (HSGQG Tiếng Anh) Day 2 Speaking Examiner. Evaluate C1–C2 critical argumentation, academic register, and rhetorical precision. Keep your spoken responses natural, articulate, and concise (2–3 sentences per turn).'
      : examMode === 'hsg'
        ? 'You are a Provincial/City HSG Tiếng Anh Gifted Round 2 Speaking Examiner. Probe analytical depth, nuanced vocabulary, and confident spoken delivery. Keep each turn focused and natural (2–3 sentences).'
        : 'You are a certified IELTS Speaking Examiner conducting a realistic face-to-face interview (Parts 1, 2, and 3). Keep your tone warm, composed, and professional—like a real Cambridge/British Council examiner. Ask one question at a time, listen attentively, respond naturally to what the candidate actually said, and follow up with probing Part 3 questions.';

  return `${modeNote}

Current session context:
- Active stage: ${turnLabel || 'Part 1 — Introduction & Interview'}
- Official prompt on screen: "${prompt || 'Let us begin with a brief introduction and discuss your daily study habits.'}"

Behavior rules for live voice:
- Speak naturally at a clear, measured pace suitable for an exam interview.
- Never read markdown symbols, bullet numbers, or stage directions aloud.
- If the student hesitates or says they did not understand a question, gently rephrase the question in simpler English just as a real examiner would.
- After the candidate answers a question thoroughly, briefly acknowledge their point and smoothly ask a relevant follow-up or move to the next question.
- Keep your spoken turns concise (typically 15 to 35 words) so the candidate does most of the speaking.`;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // 1. Multi-turn Gemini Study Agent with Google Search Grounding (gemini-4-hydrogen)
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const body = (req.body || {}) as ChatRequestBody;
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0 && !body.selectedText) {
        res.status(400).json({ error: 'Please provide a message or selected text.' });
        return;
      }

      const ai = createGeminiClient();
      const contents = messages
        .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
        .slice(-16)
        .map((m) => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.text.trim() }],
        }));

      // Enrich the latest user turn with right-click selection context if present
      if (body.selectedText && body.selectedText.trim()) {
        const snippet = body.selectedText.trim().slice(0, 1200);
        const surrounding = (body.surroundingContext || '').trim().slice(0, 1400);
        const pageCtx = (body.pageContext || 'IEAFL Practice Workspace').trim().slice(0, 200);
        const intentLabel =
          body.intent === 'grammar'
            ? 'The student specifically asked for a grammar & vocabulary breakdown.'
            : body.intent === 'trap'
              ? 'The student specifically asked to inspect exam traps, distractors, or scoring nuances.'
              : body.sourceKind === 'chatbot'
                ? 'The student selected part of YOUR OWN previous reply because they did not fully understand what you said.'
                : 'The student right-clicked and selected this excerpt from their test/study material because they want clarity.';

        const contextBlock = [
          `[STUDENT RIGHT-CLICK SELECTION CONTEXT]`,
          `Location: ${pageCtx}`,
          `Selected text: "${snippet}"`,
          surrounding && surrounding !== snippet ? `Surrounding context: "${surrounding}"` : '',
          `Signal: ${intentLabel}`,
          `Remember: Give a clear, digestible explanation first, then ask 2–3 targeted clarifying questions so you understand exactly what the student needs next.`,
        ]
          .filter(Boolean)
          .join('\n');

        if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
          const lastText = contents[contents.length - 1].parts[0].text;
          contents[contents.length - 1].parts[0].text = `${contextBlock}\n\nStudent's question: ${lastText}`;
        } else {
          contents.push({
            role: 'user',
            parts: [
              {
                text: `${contextBlock}\n\nStudent's question: I don't fully understand this part. Can you help me?`,
              },
            ],
          });
        }
      }

      const useSearch = body.useSearch !== false;
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: STUDY_AGENT_SYSTEM_INSTRUCTION,
          ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });

      const text = (response.text || '').trim();
      const groundingMeta = response.candidates?.[0]?.groundingMetadata;
      const rawChunks = groundingMeta?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];

      for (const chunk of rawChunks) {
        const uri = chunk.web?.uri;
        const title = chunk.web?.title;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: (title || uri).trim(),
            uri,
          });
        }
      }

      const searchQueries = Array.isArray(groundingMeta?.webSearchQueries)
        ? groundingMeta.webSearchQueries.filter((q): q is string => typeof q === 'string')
        : [];

      res.json({
        text: text || 'I received an empty response. Could you tell me which exact phrase you would like me to break down?',
        sources,
        searchQueries,
        grounded: useSearch,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 2. Audio Transcription via gemini-3.5-transcribe
  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType, contextHint } = (req.body || {}) as {
        audioBase64?: string;
        mimeType?: string;
        contextHint?: string;
      };
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Missing recorded audio payload.' });
        return;
      }

      const safeMime =
        typeof mimeType === 'string' && /^audio\/[a-z0-9.+-]+/i.test(mimeType)
          ? mimeType.split(';')[0]
          : 'audio/webm';

      const ai = createGeminiClient('v1beta');
      const promptText = contextHint
        ? `Transcribe this spoken student recording accurately with natural punctuation. Context: ${String(contextHint).slice(0, 180)}. Return only the clean transcription, or an empty string if no speech is audible.`
        : 'Transcribe this spoken audio accurately with natural punctuation. Return only the clean transcription, or an empty string if no speech is audible.';

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: audioBase64,
              },
            },
            { text: promptText },
          ],
        },
      });

      const rawText = (response.text || '').trim();
      const cleanedText = /^(\[?\s*(silence|no speech|inaudible|background noise|music|blank_audio)\s*\]?|\(?\s*(silence|no speech|inaudible)\s*\)?)$/i.test(
        rawText
      )
        ? ''
        : rawText;

      res.json({
        text: cleanedText,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      console.error('[Gemini Transcribe Error]', status, message);
      res.status(status).json({ error: message });
    }
  });

  // 2b. Pre-Generated Speaking Examiner TTS via gemini-3.8-flash-lite-tts (complete WAV audio)
  const ttsCache = new Map<string, string>();
  const TTS_CACHE_MAX = 48;

  app.post('/api/gemini/tts', async (req, res) => {
    try {
      const { text, voiceName, examMode } = (req.body || {}) as {
        text?: string;
        voiceName?: string;
        examMode?: string;
      };
      const cleanText = typeof text === 'string' ? text.trim().slice(0, 1200) : '';
      if (!cleanText) {
        res.status(400).json({ error: 'Missing text for speech synthesis.' });
        return;
      }

      const resolvedVoice =
        voiceName && ALLOWED_VOICES.has(voiceName) ? voiceName : 'Zephyr';
      const resolvedMode =
        examMode === 'nec' || examMode === 'hsg' ? examMode : 'ielts';
      const cacheKey = `${resolvedVoice}|${resolvedMode}|${cleanText}`;

      const cached = ttsCache.get(cacheKey);
      if (cached) {
        // Refresh LRU order
        ttsCache.delete(cacheKey);
        ttsCache.set(cacheKey, cached);
        res.json({
          audioBase64: cached,
          mimeType: 'audio/wav',
          voiceName: resolvedVoice,
          cached: true,
        });
        return;
      }

      const styleNote =
        resolvedMode === 'nec'
          ? 'Articulate, poised academic examiner speaking clearly at a measured pace'
          : resolvedMode === 'hsg'
            ? 'Warm, attentive gifted-program oral examiner speaking clearly and naturally'
            : 'Warm, composed, professional British-style IELTS Speaking examiner at a clear natural pace';

      const ai = createGeminiClient('v1beta');
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: styleNote,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: resolvedVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Gemini TTS returned no audio data.' });
        return;
      }

      ttsCache.set(cacheKey, base64Audio);
      if (ttsCache.size > TTS_CACHE_MAX) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        voiceName: resolvedVoice,
        cached: false,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });


  // Attach Vite middleware in dev, or serve built dist/ in production
  const distDir = path.resolve(__dirname, 'dist');
  if (IS_PROD && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'mpa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);

  // 3. WebSocket Bridge for Real-Time Voice Speaking Examiner (gemini-3.8-live)
  const wss = new WebSocketServer({ noServer: true });
  wss.on('error', (err) => {
    console.error('[Live WS Server Error]', extractErrorText(err));
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const cleanPath = url.pathname.replace(/\/+$/, '');
      if (cleanPath === '/api/live-speaking') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let sessionPromise: Promise<{
      sendRealtimeInput: (input: {
        audio?: { data: string; mimeType: string };
        text?: string;
      }) => void;
      close: () => void;
    } | null> | null = null;
    let closed = false;

    const safeSend = (payload: Record<string, unknown>): void => {
      if (!closed && clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(JSON.stringify(payload));
        } catch {
          // ignore send race on closing socket
        }
      }
    };

    // Keepalive ping every 20s so Cloud Run / proxy never drops active sessions
    const pingTimer = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.ping();
        } catch {
          // ignore
        }
      }
    }, 20000);

    clientWs.on('error', (err) => {
      console.error('[Live Client WS Error]', extractErrorText(err));
    });

    const startLiveSession = (opts: {
      examMode?: string;
      turnLabel?: string;
      prompt?: string;
      voiceName?: string;
    }): void => {
      if (sessionPromise) return;
      let ai: GoogleGenAI;
      try {
        // BidiGenerateContent Live WebSocket endpoint lives under v1beta
        ai = createGeminiClient('v1beta');
      } catch (err) {
        const { message } = formatGeminiError(err);
        safeSend({ type: 'error', message });
        return;
      }

      const voiceName =
        opts.voiceName && ALLOWED_VOICES.has(opts.voiceName) ? opts.voiceName : 'Zephyr';

      sessionPromise = ai.live
        .connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildExaminerInstruction(
              opts.examMode || 'ielts',
              opts.turnLabel || 'Part 1',
              opts.prompt || ''
            ),
          },
          callbacks: {
            onopen: () => {
              safeSend({ type: 'ready', voiceName });
            },
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              if (!content) return;

              if (content.interrupted) {
                safeSend({ type: 'interrupted' });
              }
              if (content.inputTranscription?.text) {
                safeSend({
                  type: 'inputTranscript',
                  text: content.inputTranscription.text,
                });
              }
              if (content.outputTranscription?.text) {
                safeSend({
                  type: 'outputTranscript',
                  text: content.outputTranscription.text,
                });
              }
              for (const part of content.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  safeSend({
                    type: 'audio',
                    data: part.inlineData.data,
                  });
                }
              }
              if (content.turnComplete) {
                safeSend({ type: 'turnComplete' });
              }
            },
            onerror: (err: unknown) => {
              const { message } = formatGeminiError(err);
              console.error('[Gemini Live Error]', message);
              safeSend({ type: 'error', message });
            },
            onclose: (ev: unknown) => {
              const reason =
                ev && typeof ev === 'object' && 'reason' in ev
                  ? String((ev as { reason?: unknown }).reason || '')
                  : '';
              safeSend({ type: 'closed', reason });
            },
          },
        })
        .catch((err: unknown) => {
          const { message } = formatGeminiError(err);
          console.error('[Gemini Live Connect Failed]', message);
          safeSend({ type: 'error', message });
          sessionPromise = null;
          return null;
        });
    };

    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          data?: string;
          text?: string;
          examMode?: string;
          turnLabel?: string;
          prompt?: string;
          voiceName?: string;
        };

        if (msg.type === 'ping') {
          safeSend({ type: 'pong' });
          return;
        }

        if (msg.type === 'start') {
          startLiveSession(msg);
          return;
        }

        if (msg.type === 'audio' && msg.data && sessionPromise) {
          void sessionPromise.then((session) => {
            if (session && !closed) {
              try {
                session.sendRealtimeInput({
                  audio: { data: msg.data as string, mimeType: 'audio/pcm;rate=16000' },
                });
              } catch {
                // ignore closed session write
              }
            }
          });
          return;
        }

        if (msg.type === 'text' && msg.text && sessionPromise) {
          void sessionPromise.then((session) => {
            if (session && !closed) {
              try {
                session.sendRealtimeInput({ text: msg.text as string });
              } catch {
                // ignore closed session write
              }
            }
          });
          return;
        }

        if (msg.type === 'stop') {
          closed = true;
          void sessionPromise?.then((session) => {
            try {
              session?.close();
            } catch {
              // ignore
            }
          });
          sessionPromise = null;
        }
      } catch {
        // Ignore malformed client messages
      }
    });

    clientWs.on('close', () => {
      closed = true;
      clearInterval(pingTimer);
      void sessionPromise?.then((session) => {
        try {
          session?.close();
        } catch {
          // ignore
        }
      });
      sessionPromise = null;
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`IEAFL server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
