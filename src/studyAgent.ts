import { transcribeAudioBlob } from './liveSpeaking';

interface GroundingSource {
  title: string;
  uri: string;
}

interface AgentMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  selectedQuote?: string;
  sources?: GroundingSource[];
  searchQueries?: string[];
  grounded?: boolean;
  error?: boolean;
}

interface ActiveSelectionPayload {
  text: string;
  surrounding: string;
  pageContext: string;
  sourceKind: 'page' | 'chatbot';
}

function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function agentPixelIcon(size = 26): string {
  // 14x14 crisp-edge pixel-art Study Agent emblem matching IEAFL palette
  const palette: Record<string, string> = {
    K: '#0A0A0A', // ink outline / visor
    W: '#FFFFFF', // paper chassis
    S: '#F3ACF0', // sodium pink eyes / highlight
    B: '#2370E8', // cobalt side ear-cups
    L: '#A98BF7', // lavender antenna spark
    G: '#22C98A', // mint smile / active pixel
  };
  const grid = [
    '......LL......',
    '......SS......',
    '......KK......',
    '..KKKKKKKKKK..',
    '.KWWWWWWWWWWK.',
    'BKWKKKKKKKKWKB',
    'BKWKSSKKSSKWKB',
    'BKWKSSKKSSKWKB',
    'BKWKKGGGGKKWKB',
    'BKWKKKKKKKKWKB',
    '.KWWWWWWWWWWK.',
    '..KKKKKKKKKK..',
    '....KKK.......',
    '....KK........',
  ];
  let rects = '';
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const fill = palette[ch];
      if (!fill) continue;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    }
  }
  return `<svg class="agent-pixel-icon" width="${size}" height="${size}" viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

function brandPixelWordmark(): string {
  const glyphs: Record<string, string[]> = {
    I: ['.#####.', '...#...', '...#...', '...#...', '...#...', '...#...', '...#...', '...#...', '.#####.'],
    E: ['#######', '#......', '#......', '#......', '######.', '#......', '#......', '#......', '#######'],
    A: ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '#######', '#.....#', '#.....#', '#.....#'],
    F: ['#######', '#......', '#......', '#......', '######.', '#......', '#......', '#......', '#......'],
    L: ['#......', '#......', '#......', '#......', '#......', '#......', '#......', '#......', '#######'],
  };
  const letters = ['I', 'E', 'A', 'F', 'L'];
  const gap = 2;
  let cursorX = 0;
  let rects = '';
  for (const ch of letters) {
    const rows = glyphs[ch];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] === '#') {
          rects += `<rect x="${cursorX + x}" y="${y}" width="1" height="1" fill="currentColor"/>`;
        }
      }
    }
    cursorX += rows[0].length + gap;
  }
  const totalW = cursorX - gap;
  return `<span class="brand-inline" aria-label="IEAFL"><svg class="inline-logo-svg" viewBox="0 0 ${totalW} 9" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg></span>`;
}

function renderSimpleMarkdown(md: string): string {
  const escaped = esc(md);
  const lines = escaped.split('\n');
  let html = '';
  let inList = false;

  const formatInline = (line: string): string =>
    line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="agent-code">$1</code>');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }
    const bulletMatch = /^[-*•]\s+(.*)$/.exec(trimmed) || /^\d+\.\s+(.*)$/.exec(trimmed);
    if (bulletMatch) {
      if (!inList) {
        html += '<ul class="agent-md-list">';
        inList = true;
      }
      html += `<li>${formatInline(bulletMatch[1])}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${formatInline(trimmed)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function getCurrentPageContext(): string {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/app/reading')) return 'Workspace · Reading Practice';
  if (hash.startsWith('#/app/listening')) return 'Workspace · Listening Practice';
  if (hash.startsWith('#/app/writing')) return 'Workspace · Writing Studio';
  if (hash.startsWith('#/app/speaking')) return 'Workspace · 3D Speaking Examiner';
  if (hash.startsWith('#/app')) return 'IEAFL Practice Workspace';
  if (hash.startsWith('#/formats')) return 'Official 5-Exam Format Reference';
  if (hash.startsWith('#/study-plan')) return '12-Week Study Plan Roadmap';
  if (hash.startsWith('#/profile')) return 'Student Profile & Band Forecast';
  return 'IEAFL Multi-Exam Platform';
}

function captureCurrentSelection(targetNode?: Node | null): ActiveSelectionPayload | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;
  const text = sel.toString().trim();
  if (text.length < 2) return null;

  const anchor = targetNode || sel.anchorNode;
  const el =
    anchor instanceof HTMLElement
      ? anchor
      : anchor?.parentElement || null;

  const isInsideAgent = Boolean(el?.closest('#ieafl-agent-drawer'));
  const blockEl = el?.closest(
    '.ws-para, .ws-q-card, .ws-cue-row, .ws-examiner-prompt-card, .agent-msg-body, p, li, article, section'
  );
  const surrounding = (blockEl?.textContent || text).replace(/\s+/g, ' ').trim().slice(0, 800);

  return {
    text: text.slice(0, 600),
    surrounding,
    pageContext: isInsideAgent ? 'IEAFL Study Agent Reply' : getCurrentPageContext(),
    sourceKind: isInsideAgent ? 'chatbot' : 'page',
  };
}

export function initStudyAgent(): void {
  if (document.getElementById('ieafl-agent-root')) return;

  let isOpen = false;
  let useSearch = true;
  let busy = false;
  let micRecording = false;
  let micStatus = '';
  let draftInput = '';
  let pendingSelection: ActiveSelectionPayload | null = null;
  let contextSelection: ActiveSelectionPayload | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: BlobPart[] = [];

  const messages: AgentMessage[] = [
    {
      id: 'welcome-0',
      role: 'model',
      text:
        'Hi — I am your **IEAFL Study Agent**, grounded with live **Google Search** for IELTS, NEC (HSGQG), Digital SAT (R&W + Math), HSG, and Olympic 30/4.\n\n- **Stuck on any passage, question, or even something I say?** Highlight the exact words, **right-click**, and choose **Ask IEAFL Agent**.\n- I will break it down simply and ask clarifying questions to pinpoint what you actually need.\n\nWhich exam or question are you working on right now?',
      grounded: true,
    },
  ];

  const root = document.createElement('div');
  root.id = 'ieafl-agent-root';
  document.body.appendChild(root);

  const menuEl = document.createElement('div');
  menuEl.id = 'ieafl-selection-menu';
  menuEl.className = 'agent-ctx-menu';
  menuEl.setAttribute('role', 'menu');
  menuEl.hidden = true;
  document.body.appendChild(menuEl);

  const floatBtn = document.createElement('button');
  floatBtn.id = 'ieafl-selection-fab';
  floatBtn.type = 'button';
  floatBtn.className = 'agent-sel-pill t-micro';
  floatBtn.hidden = true;
  floatBtn.innerHTML = `${agentPixelIcon(16)}<span>Ask ${brandPixelWordmark()} Agent</span>`;
  document.body.appendChild(floatBtn);

  function hideContextMenu(): void {
    menuEl.hidden = true;
  }

  function hideSelectionPill(): void {
    floatBtn.hidden = true;
  }

  function showContextMenu(x: number, y: number, payload: ActiveSelectionPayload): void {
    contextSelection = payload;
    const preview =
      payload.text.length > 46 ? `${payload.text.slice(0, 44)}…` : payload.text;
    const askLabel =
      payload.sourceKind === 'chatbot'
        ? "I don't understand what you said — explain simply"
        : 'Ask IEAFL Agent about this selection';

    menuEl.innerHTML = `
      <div class="agent-ctx-head t-micro">
        <span class="agent-ctx-title">${agentPixelIcon(18)}<span>${brandPixelWordmark()} AGENT · RIGHT-CLICK</span></span>
        <span class="agent-ctx-quote">"${esc(preview)}"</span>
      </div>
      <button type="button" class="agent-ctx-item t-small" data-ctx-action="understand">${esc(askLabel)}</button>
      <button type="button" class="agent-ctx-item t-small" data-ctx-action="grammar">Break down grammar &amp; vocabulary</button>
      <button type="button" class="agent-ctx-item t-small" data-ctx-action="trap">Check exam trap / distractor logic</button>
      <button type="button" class="agent-ctx-item t-micro is-muted" data-ctx-action="copy">Copy selected text</button>
    `;

    menuEl.hidden = false;
    const rect = menuEl.getBoundingClientRect();
    const clampedX = Math.min(window.innerWidth - rect.width - 12, Math.max(12, x));
    const clampedY = Math.min(window.innerHeight - rect.height - 12, Math.max(12, y));
    menuEl.style.left = `${clampedX}px`;
    menuEl.style.top = `${clampedY}px`;
  }

  async function sendToAgent(opts: {
    userText: string;
    selection?: ActiveSelectionPayload | null;
    intent?: 'understand' | 'grammar' | 'trap' | 'general';
  }): Promise<void> {
    if (busy) return;
    const trimmed = opts.userText.trim();
    if (!trimmed && !opts.selection) return;

    const sel = opts.selection ?? pendingSelection;
    pendingSelection = null;
    draftInput = '';
    isOpen = true;

    const userDisplay =
      trimmed ||
      (sel?.sourceKind === 'chatbot'
        ? "I didn't quite understand this part of your explanation. Can you clarify?"
        : "I don't fully understand this excerpt. Can you help me break it down?");

    messages.push({
      id: `u-${Date.now()}`,
      role: 'user',
      text: userDisplay,
      selectedQuote: sel?.text,
    });

    busy = true;
    render();
    scrollToBottom();

    try {
      const historyPayload = messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyPayload,
          selectedText: sel?.text,
          surroundingContext: sel?.surrounding,
          pageContext: sel?.pageContext || getCurrentPageContext(),
          sourceKind: sel?.sourceKind || 'page',
          intent: opts.intent || 'general',
          useSearch,
        }),
      });
      const data = (await res.json()) as {
        text?: string;
        sources?: GroundingSource[];
        searchQueries?: string[];
        grounded?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Gemini Study Agent request failed.');
      }

      messages.push({
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.text || 'Could you share which part feels unclear so I can focus there?',
        sources: Array.isArray(data.sources) ? data.sources : [],
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
        grounded: Boolean(data.grounded),
      });
    } catch (err) {
      messages.push({
        id: `e-${Date.now()}`,
        role: 'model',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to reach the Gemini Study Agent right now.',
        error: true,
      });
    } finally {
      busy = false;
      render();
      scrollToBottom();
    }
  }

  async function toggleAgentVoiceInput(): Promise<void> {
    if (micRecording && mediaRecorder) {
      mediaRecorder.stop();
      micRecording = false;
      micStatus = 'Transcribing with Gemini 3.5…';
      render();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunks.push(ev.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        try {
          const transcript = await transcribeAudioBlob(blob, 'Student asking IEAFL Study Agent');
          if (transcript) {
            draftInput = draftInput ? `${draftInput} ${transcript}` : transcript;
            micStatus = 'Transcribed cleanly — press Send or edit.';
          } else {
            micStatus = 'No speech detected. Try speaking closer to the mic.';
          }
        } catch (err) {
          micStatus = err instanceof Error ? err.message : 'Transcription error.';
        } finally {
          render();
          const inputEl = document.getElementById('agent-input') as HTMLTextAreaElement | null;
          inputEl?.focus();
        }
      };
      mediaRecorder.start();
      micRecording = true;
      micStatus = 'Recording microphone… click Stop to transcribe.';
      render();
    } catch {
      micStatus = 'Microphone permission denied. You can still type or right-click text.';
      render();
    }
  }

  function scrollToBottom(): void {
    const thread = document.getElementById('agent-thread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }

  function render(): void {
    root.innerHTML = `
      <button type="button" id="ieafl-agent-fab" class="agent-fab t-small" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="ieafl-agent-drawer" aria-label="${isOpen ? 'Close IEAFL Study Agent' : 'Open IEAFL Study Agent'}">
        <span class="agent-fab-icon-wrap" aria-hidden="true">${agentPixelIcon(28)}</span>
        <span class="agent-fab-label">${isOpen ? 'Close Agent' : `Ask ${brandPixelWordmark()} Agent`}</span>
      </button>

      <aside id="ieafl-agent-drawer" class="agent-drawer${isOpen ? ' is-open' : ''}" aria-label="IEAFL Gemini Study Agent" ${isOpen ? '' : 'hidden'}>
        <header class="agent-head">
          <div class="agent-head-brand">
            ${agentPixelIcon(28)}
            <div>
              <p class="t-micro fw-600">${brandPixelWordmark()} STUDY AGENT · GEMINI 4 HYDROGEN</p>
              <p class="t-micro" style="opacity:0.78;margin-top:2px;">Select any text on the page or in this chat, then right-click to ask.</p>
            </div>
          </div>
          <div class="agent-head-actions">
            <button type="button" class="chip-toggle t-micro" id="agent-search-toggle" aria-pressed="${useSearch ? 'true' : 'false'}" title="Toggle Google Search grounding">
              (${useSearch ? 'Google Search: ON' : 'Google Search: OFF'})
            </button>
            <button type="button" class="chip-toggle t-micro" id="agent-close-btn">(Close)</button>
          </div>
        </header>

        <div class="agent-thread" id="agent-thread" role="log" aria-live="polite">
          ${messages
            .map(
              (m) => `
            <div class="agent-msg ${m.role === 'user' ? 'is-user' : 'is-model'}${m.error ? ' is-error' : ''}">
              <div class="agent-msg-meta t-micro">
                <span>${m.role === 'user' ? 'YOU' : 'IEAFL AGENT'}</span>
                ${m.role === 'model' && m.grounded ? '<span>GOOGLE SEARCH GROUNDED</span>' : ''}
              </div>
              ${
                m.selectedQuote
                  ? `<blockquote class="agent-quote t-micro">"${esc(m.selectedQuote)}"</blockquote>`
                  : ''
              }
              <div class="agent-msg-body t-small">${renderSimpleMarkdown(m.text)}</div>
              ${
                m.sources && m.sources.length > 0
                  ? `<div class="agent-sources">
                      <span class="t-micro fw-600">Verified Google Search Sources:</span>
                      <div class="agent-source-list">
                        ${m.sources
                          .slice(0, 5)
                          .map(
                            (s) =>
                              `<a class="agent-source-link t-micro" href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`
                          )
                          .join('')}
                      </div>
                    </div>`
                  : ''
              }
            </div>
          `
            )
            .join('')}
          ${
            busy
              ? `<div class="agent-msg is-model">
                  <div class="agent-msg-meta t-micro"><span>IEAFL AGENT</span><span>${useSearch ? 'SEARCHING & THINKING…' : 'THINKING…'}</span></div>
                  <div class="agent-msg-body t-small"><p>Checking your selection and preparing clarifying questions…</p></div>
                </div>`
              : ''
          }
        </div>

        <div class="agent-quick-row">
          <button type="button" class="agent-quick-btn t-micro" data-agent-quick="Explain that even more simply with an everyday example.">Explain simpler</button>
          <button type="button" class="agent-quick-btn t-micro" data-agent-quick="Give me a quick Vietnamese nuance gloss for the key terms here.">Vietnamese gloss</button>
          <button type="button" class="agent-quick-btn t-micro" data-agent-quick="Quiz me with one short practice check so I know I got it.">1-Q practice check</button>
          <button type="button" class="agent-quick-btn t-micro" data-agent-quick="Look up the latest 2025-2026 official exam structure or scoring rules for my exam.">Search official rules</button>
        </div>

        ${
          pendingSelection
            ? `<div class="agent-attached-sel t-micro">
                <div>
                  <strong>Attached selection (${esc(pendingSelection.pageContext)}):</strong>
                  <span>"${esc(pendingSelection.text.slice(0, 120))}${pendingSelection.text.length > 120 ? '…' : ''}"</span>
                </div>
                <button type="button" class="chip-toggle t-micro" id="agent-clear-sel">(Remove)</button>
              </div>`
            : ''
        }

        ${micStatus ? `<div class="agent-mic-note t-micro">${esc(micStatus)}</div>` : ''}

        <form class="agent-composer" id="agent-form">
          <textarea id="agent-input" class="agent-textarea t-small" rows="2" placeholder="Ask about IELTS, NEC, Digital SAT, HSG, or Olympic 30/4 — or tell me what felt unclear…" ${busy ? 'disabled' : ''}>${esc(draftInput)}</textarea>
          <div class="agent-composer-bar">
            <button type="button" class="chip-toggle t-micro" id="agent-mic-btn" aria-pressed="${micRecording ? 'true' : 'false'}" ${busy ? 'disabled' : ''}>
              (${micRecording ? 'Stop Mic & Transcribe' : 'Voice Question · Gemini STT'})
            </button>
            <button type="submit" class="btn-primary btn-sm t-small" id="agent-send-btn" ${busy ? 'disabled' : ''}>
              <span>${busy ? 'Sending…' : 'Ask Agent'}</span>
            </button>
          </div>
        </form>
      </aside>
    `;

    // Wire drawer controls
    document.getElementById('ieafl-agent-fab')?.addEventListener('click', () => {
      isOpen = !isOpen;
      render();
      if (isOpen) scrollToBottom();
    });

    document.getElementById('agent-close-btn')?.addEventListener('click', () => {
      isOpen = false;
      render();
    });

    document.getElementById('agent-search-toggle')?.addEventListener('click', () => {
      useSearch = !useSearch;
      render();
    });

    document.getElementById('agent-clear-sel')?.addEventListener('click', () => {
      pendingSelection = null;
      render();
    });

    document.getElementById('agent-mic-btn')?.addEventListener('click', () => {
      void toggleAgentVoiceInput();
    });

    const inputEl = document.getElementById('agent-input') as HTMLTextAreaElement | null;
    inputEl?.addEventListener('input', () => {
      draftInput = inputEl.value;
    });
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendToAgent({ userText: draftInput });
      }
    });

    document.getElementById('agent-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void sendToAgent({ userText: draftInput });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-agent-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.agentQuick || '';
        void sendToAgent({ userText: prompt });
      });
    });
  }

  // Right-click handler on any highlighted text (page OR inside chatbot itself)
  document.addEventListener('contextmenu', (e) => {
    const payload = captureCurrentSelection(e.target as Node | null);
    if (!payload) {
      hideContextMenu();
      return;
    }
    e.preventDefault();
    hideSelectionPill();
    showContextMenu(e.clientX, e.clientY, payload);
  });

  // Floating subtle selection helper for trackpad/touch users alongside right-click
  document.addEventListener('mouseup', (e) => {
    if ((e.target as HTMLElement | null)?.closest('#ieafl-selection-menu, #ieafl-selection-fab')) {
      return;
    }
    window.setTimeout(() => {
      const payload = captureCurrentSelection(e.target as Node | null);
      if (!payload || payload.text.length < 3) {
        hideSelectionPill();
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      contextSelection = payload;
      floatBtn.hidden = false;
      const top = Math.max(66, rect.top - 36);
      const left = Math.min(window.innerWidth - 260, Math.max(12, rect.left));
      floatBtn.style.top = `${top}px`;
      floatBtn.style.left = `${left}px`;
    }, 20);
  });

  floatBtn.addEventListener('click', () => {
    const sel = contextSelection;
    hideSelectionPill();
    if (!sel) return;
    const prompt =
      sel.sourceKind === 'chatbot'
        ? `I didn't quite understand this part of what you just said: "${sel.text}". Can you re-explain it more clearly and check what I'm missing?`
        : `I selected "${sel.text}" while studying and I'm not completely sure about it. Can you explain it clearly and ask me clarifying questions to help?`;
    void sendToAgent({ userText: prompt, selection: sel, intent: 'understand' });
  });

  menuEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-ctx-action]');
    if (!btn) return;
    const action = btn.dataset.ctxAction;
    const sel = contextSelection;
    hideContextMenu();
    hideSelectionPill();
    if (!sel) return;

    if (action === 'copy') {
      void navigator.clipboard?.writeText(sel.text).catch(() => undefined);
      return;
    }

    if (action === 'grammar') {
      void sendToAgent({
        userText: `Please break down the grammar structure and key vocabulary in "${sel.text}".`,
        selection: sel,
        intent: 'grammar',
      });
    } else if (action === 'trap') {
      void sendToAgent({
        userText: `Could there be an exam trap, distractor, or rubric nuance in "${sel.text}"?`,
        selection: sel,
        intent: 'trap',
      });
    } else {
      const prompt =
        sel.sourceKind === 'chatbot'
          ? `I didn't quite understand this part of your reply: "${sel.text}". Can you explain it more simply and check what I'm unsure about?`
          : `I don't fully understand "${sel.text}". Can you explain it and ask me what part is tripping me up?`;
      void sendToAgent({
        userText: prompt,
        selection: sel,
        intent: 'understand',
      });
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('#ieafl-selection-menu')) {
      hideContextMenu();
    }
    if (!target?.closest('#ieafl-selection-fab')) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) hideSelectionPill();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      hideSelectionPill();
    }
  });

  render();
}
