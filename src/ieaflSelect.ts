// Custom Swiss-Brutalist + Pixel-Raster Dropdown Enhancer for IEAFL
// Replaces native OS <select> popup menus cleanly while preserving native value, disabled, and change events.

interface ActivePortal {
  select: HTMLSelectElement;
  button: HTMLButtonElement;
  menu: HTMLDivElement;
  highlightedIdx: number;
  cleanup: () => void;
}

let activePortal: ActivePortal | null = null;
let uidCounter = 0;

function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOptionLabelHtml(rawText: string, compact = false): string {
  const clean = rawText.trim();
  const mockMatch = clean.match(/^(\[MOCK EXAM\s+\d+\])\s*(.*)$/i);
  if (mockMatch) {
    const tag = escHtml(mockMatch[1]);
    const rest = escHtml(mockMatch[2]);
    return `<span class="ieafl-opt-tag${compact ? ' is-compact' : ''}">${tag}</span><span class="ieafl-opt-txt">${rest}</span>`;
  }
  return `<span class="ieafl-opt-txt">${escHtml(clean)}</span>`;
}

function pixelChevronSvg(): string {
  return `<svg class="ieafl-dd-chev" width="11" height="7" viewBox="0 0 11 7" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="0" y="0" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="0" width="2" height="2" fill="currentColor"/>
    <rect x="2" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="7" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="4" y="4" width="3" height="2" fill="currentColor"/>
  </svg>`;
}

function pixelCheckSvg(): string {
  return `<svg width="10" height="8" viewBox="0 0 10 8" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="0" y="4" width="2" height="2" fill="currentColor"/>
    <rect x="2" y="6" width="2" height="2" fill="currentColor"/>
    <rect x="4" y="4" width="2" height="2" fill="currentColor"/>
    <rect x="6" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="8" y="0" width="2" height="2" fill="currentColor"/>
  </svg>`;
}

export function closeAllIeaflDropdowns(restoreFocus = false): void {
  if (!activePortal) return;
  const portal = activePortal;
  activePortal = null;
  portal.cleanup();
  portal.button.setAttribute('aria-expanded', 'false');
  portal.button.closest('.ieafl-dd')?.classList.remove('is-open');
  portal.menu.remove();
  if (restoreFocus && portal.button.isConnected) {
    portal.button.focus();
  }
}

export function syncIeaflSelect(select: HTMLSelectElement): void {
  const wrapper = select.nextElementSibling as HTMLElement | null;
  if (!wrapper || !wrapper.classList.contains('ieafl-dd')) return;
  const btn = wrapper.querySelector<HTMLButtonElement>('.ieafl-dd-btn');
  const valSpan = wrapper.querySelector<HTMLElement>('.ieafl-dd-value');
  if (!btn || !valSpan) return;

  const isCompact = select.classList.contains('ws-3d-select');
  const selectedOpt = select.options[select.selectedIndex] || select.options[0];
  valSpan.innerHTML = selectedOpt ? formatOptionLabelHtml(selectedOpt.text, isCompact) : '<span>Select…</span>';
  btn.disabled = select.disabled;
  wrapper.classList.toggle('is-disabled', select.disabled);
}

function openDropdown(select: HTMLSelectElement, button: HTMLButtonElement): void {
  if (select.disabled) return;
  const alreadyOpenForSame = activePortal && activePortal.select === select;
  closeAllIeaflDropdowns(false);
  if (alreadyOpenForSame) return;

  const isCompact = select.classList.contains('ws-3d-select');
  const options = Array.from(select.options);
  if (options.length === 0) return;

  const menu = document.createElement('div');
  menu.className = `ieafl-dd-menu${isCompact ? ' is-compact' : ''}`;
  menu.setAttribute('role', 'listbox');
  const listId = `ieafl-dd-list-${++uidCounter}`;
  menu.id = listId;
  button.setAttribute('aria-controls', listId);

  const labelEl =
    (select.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(select.id)}"]`) : null) ||
    null;
  const headerTitle =
    labelEl?.textContent?.trim() ||
    select.getAttribute('aria-label') ||
    'Select Option';

  menu.innerHTML = `
    <div class="ieafl-dd-menu-head t-micro">
      <span>${escHtml(headerTitle)} · ${options.length}</span>
      <span class="ieafl-dd-pixels" aria-hidden="true">
        <i style="background:#D873B3"></i>
        <i style="background:#2BA676"></i>
        <i style="background:#2370E8"></i>
      </span>
    </div>
    <div class="ieafl-dd-list">
      ${options
        .map((opt, idx) => {
          const isSel = idx === select.selectedIndex;
          return `<button type="button" class="ieafl-dd-opt${isSel ? ' is-selected' : ''}" role="option" data-opt-idx="${idx}" aria-selected="${isSel ? 'true' : 'false'}" ${opt.disabled ? 'disabled' : ''}>
            <span class="ieafl-dd-opt-main">${formatOptionLabelHtml(opt.text, isCompact)}</span>
            <span class="ieafl-dd-check">${isSel ? pixelCheckSvg() : ''}</span>
          </button>`;
        })
        .join('')}
    </div>
  `;

  document.body.appendChild(menu);

  // Position cleanly without clipping against viewport or overflow-hidden parent panes
  const rect = button.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minW = Math.max(rect.width, isCompact ? 190 : 300);
  const maxW = Math.min(vw - 20, isCompact ? 320 : 600);
  menu.style.minWidth = `${Math.min(minW, maxW)}px`;
  menu.style.maxWidth = `${maxW}px`;

  const menuRect = menu.getBoundingClientRect();
  const spaceBelow = vh - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const openUpward = spaceBelow < Math.min(menuRect.height, 240) && spaceAbove > spaceBelow;

  let left = rect.left;
  if (left + menuRect.width > vw - 10) {
    left = Math.max(10, vw - menuRect.width - 10);
  }
  left = Math.max(10, left);

  menu.style.left = `${Math.round(left)}px`;
  if (openUpward) {
    const availH = Math.max(140, Math.min(340, spaceAbove - 6));
    menu.style.maxHeight = `${availH}px`;
    menu.style.top = 'auto';
    menu.style.bottom = `${Math.round(vh - rect.top + 4)}px`;
  } else {
    const availH = Math.max(140, Math.min(340, spaceBelow - 6));
    menu.style.maxHeight = `${availH}px`;
    menu.style.bottom = 'auto';
    menu.style.top = `${Math.round(rect.bottom + 4)}px`;
  }

  button.setAttribute('aria-expanded', 'true');
  button.closest('.ieafl-dd')?.classList.add('is-open');

  const optButtons = Array.from(menu.querySelectorAll<HTMLButtonElement>('.ieafl-dd-opt'));
  let highlightedIdx = Math.max(0, select.selectedIndex);

  const highlight = (idx: number): void => {
    optButtons.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    highlightedIdx = idx;
    optButtons[idx]?.scrollIntoView({ block: 'nearest' });
  };
  highlight(highlightedIdx);

  const choose = (idx: number): void => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    const prevIdx = select.selectedIndex;
    select.selectedIndex = idx;
    syncIeaflSelect(select);
    closeAllIeaflDropdowns(true);
    if (prevIdx !== idx) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  optButtons.forEach((optBtn, idx) => {
    optBtn.addEventListener('mouseenter', () => highlight(idx));
    optBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      choose(idx);
    });
  });

  const onDocPointerDown = (e: PointerEvent): void => {
    const t = e.target as Node | null;
    if (!t) return;
    if (menu.contains(t) || button.contains(t)) return;
    closeAllIeaflDropdowns(false);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAllIeaflDropdowns(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight((highlightedIdx + 1) % optButtons.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight((highlightedIdx - 1 + optButtons.length) % optButtons.length);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      highlight(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      highlight(optButtons.length - 1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(highlightedIdx);
    }
  };

  const onWinResizeOrScroll = (e: Event): void => {
    if (e.type === 'scroll' && e.target instanceof Node && menu.contains(e.target)) return;
    closeAllIeaflDropdowns(false);
  };

  window.setTimeout(() => {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onWinResizeOrScroll, { passive: true });
    window.addEventListener('scroll', onWinResizeOrScroll, { capture: true, passive: true });
  }, 0);

  activePortal = {
    select,
    button,
    menu,
    highlightedIdx,
    cleanup: () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onWinResizeOrScroll);
      window.removeEventListener('scroll', onWinResizeOrScroll, true);
    },
  };
}

export function enhanceIeaflSelects(root: ParentNode = document): void {
  closeAllIeaflDropdowns(false);

  const selects = Array.from(root.querySelectorAll<HTMLSelectElement>('select'));
  for (const select of selects) {
    if (select.dataset.ieaflEnhanced === '1') {
      syncIeaflSelect(select);
      continue;
    }

    select.dataset.ieaflEnhanced = '1';
    select.classList.add('ieafl-native-select-hidden');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const isCompact = select.classList.contains('ws-3d-select');
    const isWs = select.classList.contains('ws-select');
    const wrapper = document.createElement('div');
    wrapper.className = `ieafl-dd${isCompact ? ' is-compact' : ''}${isWs ? ' is-ws' : ''}${select.disabled ? ' is-disabled' : ''}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ieafl-dd-btn ${isCompact ? 't-micro' : 't-small'}`;
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (select.getAttribute('aria-label')) {
      btn.setAttribute('aria-label', select.getAttribute('aria-label') || '');
    }
    btn.disabled = select.disabled;

    const valSpan = document.createElement('span');
    valSpan.className = 'ieafl-dd-value';
    btn.appendChild(valSpan);
    btn.insertAdjacentHTML('beforeend', pixelChevronSvg());

    wrapper.appendChild(btn);
    select.insertAdjacentElement('afterend', wrapper);
    syncIeaflSelect(select);

    // Clicking an associated <label for="..."> opens or focuses the custom trigger
    if (select.id) {
      const assocLabel = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(select.id)}"]`);
      if (assocLabel && assocLabel.dataset.ieaflLabelBound !== '1') {
        assocLabel.dataset.ieaflLabelBound = '1';
        assocLabel.addEventListener('click', (e) => {
          e.preventDefault();
          btn.focus();
          openDropdown(select, btn);
        });
      }
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDropdown(select, btn);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        if (!activePortal || activePortal.select !== select) {
          e.preventDefault();
          openDropdown(select, btn);
        }
      }
    });

    select.addEventListener('change', () => syncIeaflSelect(select));
  }
}

declare global {
  interface Window {
    IEAFL_ENHANCE_SELECTS?: (root?: ParentNode) => void;
  }
}

if (typeof window !== 'undefined') {
  window.IEAFL_ENHANCE_SELECTS = enhanceIeaflSelects;
}
