import type { AttemptRecord, SkillId, UserProfile } from './firebase';

export type ExamId = 'ielts' | 'nec' | 'sat' | 'hsg' | 'olympic304';

export const EXAM_ORDER: ExamId[] = ['ielts', 'nec', 'sat', 'hsg', 'olympic304'];

export type SectionUnit = 'band' | 'sat_section' | 'pts20' | 'pts100';

export interface ExamSectionDef {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  workspaceTab: SkillId;
  defaultTestId: string;
  minScore: number;
  maxScore: number;
  unit: SectionUnit;
  weightLabel: string;
}

export interface ExamScoringConfig {
  id: ExamId;
  short: string;
  fullName: string;
  scaleName: string;
  scaleRangeLabel: string;
  min: number;
  max: number;
  step: number;
  defaultTarget: number;
  targetOptions: number[];
  chartMin: number;
  chartMax: number;
  chartTicks: number[];
  noSpeakingNote?: string;
  formatScore: (val: number) => string;
  formatShort: (val: number) => string;
  formatDelta: (delta: number) => string;
  formatSectionScore: (sec: ExamSectionDef, val: number) => string;
  sections: ExamSectionDef[];
}

export interface ExamGoal {
  target: number;
  examDate: string;
}

export interface ClassifiedAttempt {
  attempt: AttemptRecord;
  examId: ExamId;
  sectionKey: string;
  sectionLabel: string;
  ratio: number; // 0..1 accuracy/quality within that exam
  sectionScore: number; // native section score (e.g. 680/800, 4.0/5.0, 24/30, Band 6.5)
  examPaceScore: number; // native overall exam score (e.g. 1360/1600, 16.0/20.0, 80/100, Band 6.5)
  nativeScoreLabel: string;
  nativeSectionLabel: string;
}

export interface SectionReadinessRow {
  section: ExamSectionDef;
  attemptsCount: number;
  avgSectionScore: number | null;
  bestSectionScore: number | null;
  avgRatio: number | null;
  fillPct: number;
  displayValue: string;
  bestDisplayValue: string;
  practiceHref: string;
}

export interface ExamForecast {
  examId: ExamId;
  config: ExamScoringConfig;
  monthName: string;
  target: number;
  examDate: string;
  daysLeft: number;
  roadmapDone: number;
  totalExamAttempts: number;
  attemptsThisMonth: number;
  sectionsLoggedCount: number;
  hasData: boolean;
  currentScore: number | null;
  projectedScore: number | null;
  deltaToGoal: number | null;
  verdict: string;
  weeks: Array<{ label: string; val: number }>;
  sectionRows: SectionReadinessRow[];
  examAttempts: ClassifiedAttempt[];
}

const EXAM_GOALS_STORAGE_KEY = 'ieafl.examGoals.v1';

export function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

export function roundTen(n: number): number {
  return Math.round(n / 10) * 10;
}

export function ratioToIeltsBand(ratio: number): number {
  const pct = Math.max(0, Math.min(1, ratio));
  if (pct >= 0.96) return 9.0;
  if (pct >= 0.88) return 8.5;
  if (pct >= 0.80) return 8.0;
  if (pct >= 0.72) return 7.5;
  if (pct >= 0.63) return 7.0;
  if (pct >= 0.54) return 6.5;
  if (pct >= 0.45) return 6.0;
  if (pct >= 0.35) return 5.5;
  if (pct >= 0.25) return 5.0;
  return 4.5;
}

export function isValidExamId(val: unknown): val is ExamId {
  return typeof val === 'string' && (EXAM_ORDER as string[]).includes(val);
}

export const EXAM_CONFIGS: Record<ExamId, ExamScoringConfig> = {
  ielts: {
    id: 'ielts',
    short: 'IELTS',
    fullName: 'IELTS Academic & General',
    scaleName: 'IELTS Band',
    scaleRangeLabel: 'Band 0.0–9.0',
    min: 4.0,
    max: 9.0,
    step: 0.5,
    defaultTarget: 7.5,
    targetOptions: [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0],
    chartMin: 4.0,
    chartMax: 9.0,
    chartTicks: [5, 6, 7, 8, 9],
    formatScore: (v) => `Band ${roundHalf(v).toFixed(1)}`,
    formatShort: (v) => roundHalf(v).toFixed(1),
    formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.abs(roundHalf(d)).toFixed(1)} band`,
    formatSectionScore: (_sec, v) => `Band ${roundHalf(v).toFixed(1)}`,
    sections: [
      {
        key: 'reading',
        label: 'Academic Reading',
        shortLabel: 'Reading',
        color: '#D873B3',
        workspaceTab: 'reading',
        defaultTestId: 'mock-r1',
        minScore: 0,
        maxScore: 9.0,
        unit: 'band',
        weightLabel: '40 Qs · 60 min',
      },
      {
        key: 'listening',
        label: 'Listening (Parts 1–4)',
        shortLabel: 'Listening',
        color: '#2BA676',
        workspaceTab: 'listening',
        defaultTestId: 'mock-l1',
        minScore: 0,
        maxScore: 9.0,
        unit: 'band',
        weightLabel: '40 Qs · 30 min',
      },
      {
        key: 'writing',
        label: 'Writing (Tasks 1 & 2)',
        shortLabel: 'Writing',
        color: '#A98BF7',
        workspaceTab: 'writing',
        defaultTestId: 'mock-w1',
        minScore: 0,
        maxScore: 9.0,
        unit: 'band',
        weightLabel: '2 Tasks · 60 min',
      },
      {
        key: 'speaking',
        label: 'Speaking (Parts 1–3)',
        shortLabel: 'Speaking',
        color: '#2370E8',
        workspaceTab: 'speaking',
        defaultTestId: 'mock-s1',
        minScore: 0,
        maxScore: 9.0,
        unit: 'band',
        weightLabel: '3D Interview · 14 min',
      },
    ],
  },

  nec: {
    id: 'nec',
    short: 'NEC · HSGQG',
    fullName: 'NEC (HSGQG Tiếng Anh)',
    scaleName: 'NEC Score',
    scaleRangeLabel: '0.0–20.0 pts',
    min: 0.0,
    max: 20.0,
    step: 0.1,
    defaultTarget: 15.5,
    targetOptions: [12.0, 13.0, 14.0, 15.0, 15.5, 16.0, 16.5, 17.0, 18.0, 19.0],
    chartMin: 6.0,
    chartMax: 20.0,
    chartTicks: [8, 11, 14, 17, 20],
    formatScore: (v) => `${roundTenth(v).toFixed(1)} / 20.0`,
    formatShort: (v) => roundTenth(v).toFixed(1),
    formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.abs(roundTenth(d)).toFixed(1)} pts`,
    formatSectionScore: (sec, v) => `${roundTenth(v).toFixed(1)} / ${sec.maxScore.toFixed(1)} pts`,
    sections: [
      {
        key: 'listening',
        label: 'Part A · Listening',
        shortLabel: 'Listening',
        color: '#2BA676',
        workspaceTab: 'listening',
        defaultTestId: 'nec25-l1',
        minScore: 0,
        maxScore: 5.0,
        unit: 'pts20',
        weightLabel: '5.0 / 20.0 pts',
      },
      {
        key: 'lexico',
        label: 'Part B · Lexico-Grammar',
        shortLabel: 'Lexico-Grammar',
        color: '#FF5A5A',
        workspaceTab: 'reading',
        defaultTestId: 'nec25-r1',
        minScore: 0,
        maxScore: 2.0,
        unit: 'pts20',
        weightLabel: '2.0 / 20.0 pts',
      },
      {
        key: 'reading',
        label: 'Part C · Reading & Cloze',
        shortLabel: 'Reading',
        color: '#D873B3',
        workspaceTab: 'reading',
        defaultTestId: 'nec25-rc1',
        minScore: 0,
        maxScore: 5.0,
        unit: 'pts20',
        weightLabel: '5.0 / 20.0 pts',
      },
      {
        key: 'writing',
        label: 'Part D · Writing (Sum, Chart, Essay)',
        shortLabel: 'Writing',
        color: '#A98BF7',
        workspaceTab: 'writing',
        defaultTestId: 'nec25-w1',
        minScore: 0,
        maxScore: 6.0,
        unit: 'pts20',
        weightLabel: '6.0 / 20.0 pts',
      },
      {
        key: 'speaking',
        label: 'Day 2 · Monologue Speaking',
        shortLabel: 'Day 2 Speaking',
        color: '#2370E8',
        workspaceTab: 'speaking',
        defaultTestId: 'mock-s2',
        minScore: 0,
        maxScore: 2.0,
        unit: 'pts20',
        weightLabel: '2.0 / 20.0 pts',
      },
    ],
  },

  sat: {
    id: 'sat',
    short: 'Digital SAT',
    fullName: 'Digital SAT (Bluebook)',
    scaleName: 'SAT Composite',
    scaleRangeLabel: '400–1600',
    min: 400,
    max: 1600,
    step: 10,
    defaultTarget: 1480,
    targetOptions: [1100, 1200, 1300, 1350, 1400, 1450, 1480, 1500, 1550, 1600],
    chartMin: 600,
    chartMax: 1600,
    chartTicks: [800, 1000, 1200, 1400, 1600],
    noSpeakingNote: 'Digital SAT evaluates only Reading & Writing (200–800) and Math (200–800) — no Listening, Essay, or Speaking.',
    formatScore: (v) => `${roundTen(v)} / 1600`,
    formatShort: (v) => `${roundTen(v)}`,
    formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.abs(roundTen(d))} pts`,
    formatSectionScore: (_sec, v) => `${roundTen(v)} / 800`,
    sections: [
      {
        key: 'rw',
        label: 'Reading & Writing (Modules 1 & 2)',
        shortLabel: 'Reading & Writing',
        color: '#D873B3',
        workspaceTab: 'reading',
        defaultTestId: 'sat25-rwm1',
        minScore: 200,
        maxScore: 800,
        unit: 'sat_section',
        weightLabel: '200–800 scale',
      },
      {
        key: 'math',
        label: 'Math + Desmos (Modules 1 & 2)',
        shortLabel: 'Math',
        color: '#2370E8',
        workspaceTab: 'reading',
        defaultTestId: 'sat25-math1',
        minScore: 200,
        maxScore: 800,
        unit: 'sat_section',
        weightLabel: '200–800 scale',
      },
    ],
  },

  hsg: {
    id: 'hsg',
    short: 'HSG Tiếng Anh',
    fullName: 'HSG Tỉnh / TP & Gifted',
    scaleName: 'HSG Score',
    scaleRangeLabel: '0.0–20.0 pts',
    min: 0.0,
    max: 20.0,
    step: 0.1,
    defaultTarget: 16.0,
    targetOptions: [12.0, 13.5, 15.0, 16.0, 17.0, 18.0, 19.0],
    chartMin: 6.0,
    chartMax: 20.0,
    chartTicks: [8, 11, 14, 17, 20],
    formatScore: (v) => `${roundTenth(v).toFixed(1)} / 20.0`,
    formatShort: (v) => roundTenth(v).toFixed(1),
    formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.abs(roundTenth(d)).toFixed(1)} pts`,
    formatSectionScore: (sec, v) => `${roundTenth(v).toFixed(1)} / ${sec.maxScore.toFixed(1)} pts`,
    sections: [
      {
        key: 'listening',
        label: 'Listening Comprehension',
        shortLabel: 'Listening',
        color: '#2BA676',
        workspaceTab: 'listening',
        defaultTestId: 'hsg25-l1',
        minScore: 0,
        maxScore: 4.0,
        unit: 'pts20',
        weightLabel: '4.0 / 20.0 pts',
      },
      {
        key: 'lexico',
        label: 'Lexico-Grammar & Phonology',
        shortLabel: 'Lexico & Phonology',
        color: '#FF5A5A',
        workspaceTab: 'reading',
        defaultTestId: 'hsg25-r1',
        minScore: 0,
        maxScore: 4.0,
        unit: 'pts20',
        weightLabel: '4.0 / 20.0 pts',
      },
      {
        key: 'reading',
        label: 'Reading & Guided Cloze',
        shortLabel: 'Reading & Cloze',
        color: '#D873B3',
        workspaceTab: 'reading',
        defaultTestId: 'hsg25-rc1',
        minScore: 0,
        maxScore: 5.0,
        unit: 'pts20',
        weightLabel: '5.0 / 20.0 pts',
      },
      {
        key: 'writing',
        label: 'Sentence Rewrite & Essay',
        shortLabel: 'Writing',
        color: '#A98BF7',
        workspaceTab: 'writing',
        defaultTestId: 'hsg25-w1',
        minScore: 0,
        maxScore: 5.0,
        unit: 'pts20',
        weightLabel: '5.0 / 20.0 pts',
      },
      {
        key: 'speaking',
        label: 'Gifted Round 2 Speaking',
        shortLabel: 'Gifted Speaking',
        color: '#2370E8',
        workspaceTab: 'speaking',
        defaultTestId: 'hsg25-s1',
        minScore: 0,
        maxScore: 2.0,
        unit: 'pts20',
        weightLabel: '2.0 / 20.0 pts',
      },
    ],
  },

  olympic304: {
    id: 'olympic304',
    short: 'Olympic 30/4',
    fullName: 'Olympic 30/4 Tiếng Anh HCM',
    scaleName: 'Olympic 30/4 Score',
    scaleRangeLabel: '0–100 pts',
    min: 0,
    max: 100,
    step: 1,
    defaultTarget: 82,
    targetOptions: [60, 65, 70, 75, 80, 82, 85, 90, 95],
    chartMin: 30,
    chartMax: 100,
    chartTicks: [40, 55, 70, 85, 100],
    noSpeakingNote: 'Olympic 30/4 is a 180-minute written & MCQ exam (100 pts) — no Listening or Speaking section.',
    formatScore: (v) => `${Math.round(v)} / 100`,
    formatShort: (v) => `${Math.round(v)}`,
    formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))} pts`,
    formatSectionScore: (sec, v) => `${Math.round(v)} / ${sec.maxScore} pts`,
    sections: [
      {
        key: 'mcq',
        label: 'Multiple Choice · Lexico & Idioms',
        shortLabel: 'MCQ Lexico',
        color: '#FF5A5A',
        workspaceTab: 'reading',
        defaultTestId: 'oly25-mcq1',
        minScore: 0,
        maxScore: 20,
        unit: 'pts100',
        weightLabel: '20 / 100 pts',
      },
      {
        key: 'cloze',
        label: 'Open Cloze & Word Formation',
        shortLabel: 'Cloze & Word Form',
        color: '#2BA676',
        workspaceTab: 'reading',
        defaultTestId: 'oly25-cloze1',
        minScore: 0,
        maxScore: 30,
        unit: 'pts100',
        weightLabel: '30 / 100 pts',
      },
      {
        key: 'reading',
        label: 'Reading Comprehension (C1–C2)',
        shortLabel: 'Reading',
        color: '#D873B3',
        workspaceTab: 'reading',
        defaultTestId: 'oly25-r1',
        minScore: 0,
        maxScore: 30,
        unit: 'pts100',
        weightLabel: '30 / 100 pts',
      },
      {
        key: 'transform',
        label: 'Sentence Transformation',
        shortLabel: 'Transformation',
        color: '#A98BF7',
        workspaceTab: 'writing',
        defaultTestId: 'oly25-w1',
        minScore: 0,
        maxScore: 20,
        unit: 'pts100',
        weightLabel: '20 / 100 pts',
      },
    ],
  },
};

export function getExamSection(examId: ExamId, sectionKey: string): ExamSectionDef {
  const cfg = EXAM_CONFIGS[examId];
  return cfg.sections.find((s) => s.key === sectionKey) || cfg.sections[0];
}

export function scoreRatioToSectionScore(examId: ExamId, sectionKey: string, ratio: number): number {
  const pct = Math.max(0, Math.min(1, ratio));
  const sec = getExamSection(examId, sectionKey);
  if (examId === 'ielts') return ratioToIeltsBand(pct);
  if (examId === 'sat') {
    return Math.min(800, Math.max(200, roundTen(200 + pct * 600)));
  }
  if (examId === 'nec' || examId === 'hsg') {
    return Math.min(sec.maxScore, Math.max(0, roundTenth(pct * sec.maxScore)));
  }
  // olympic304
  return Math.min(sec.maxScore, Math.max(0, Math.round(pct * sec.maxScore)));
}

export function scoreRatioToExamPace(examId: ExamId, ratio: number): number {
  const pct = Math.max(0, Math.min(1, ratio));
  if (examId === 'ielts') return ratioToIeltsBand(pct);
  if (examId === 'sat') {
    const secScore = Math.min(800, Math.max(200, roundTen(200 + pct * 600)));
    return Math.min(1600, Math.max(400, secScore * 2));
  }
  if (examId === 'nec' || examId === 'hsg') {
    return Math.min(20.0, Math.max(0, roundTenth(pct * 20.0)));
  }
  return Math.min(100, Math.max(0, Math.round(pct * 100)));
}

export interface NativeScorePayload {
  examId: ExamId;
  sectionKey: string;
  sectionScore: number;
  examPaceScore: number;
  headline: string;
  sectionBadge: string;
  scoreText: string; // <= 64 chars for Firestore validation
  compatBand: number; // 0..9 numeric value ONLY for Firestore schema compatibility
}

/**
 * Formats an objective (Reading/Listening/MCQ/Math) attempt purely in the exam's own native scale.
 */
export function buildNativeObjectiveScore(
  examId: ExamId,
  sectionKey: string,
  correct: number,
  total: number
): NativeScorePayload {
  const cfg = EXAM_CONFIGS[examId];
  const sec = getExamSection(examId, sectionKey);
  const ratio = total > 0 ? Math.max(0, Math.min(1, correct / total)) : 0;
  const sectionScore = scoreRatioToSectionScore(examId, sectionKey, ratio);
  const examPaceScore = scoreRatioToExamPace(examId, ratio);
  const compatBand = examId === 'ielts' ? sectionScore : roundTenth(Math.min(9.0, Math.max(0.0, ratio * 9.0)));

  let headline = '';
  let scoreText = '';

  if (examId === 'ielts') {
    headline = `Band ${sectionScore.toFixed(1)} · ${correct} / ${total} Correct`;
    scoreText = `IELTS Band ${sectionScore.toFixed(1)} · ${correct}/${total}`;
  } else if (examId === 'sat') {
    headline = `${sec.shortLabel} ${sectionScore} / 800 · ${correct} / ${total} Correct`;
    scoreText = `SAT ${sec.shortLabel} ${sectionScore}/800 · ${correct}/${total}`;
  } else if (examId === 'nec') {
    headline = `${sectionScore.toFixed(1)} / ${sec.maxScore.toFixed(1)} pts (${examPaceScore.toFixed(1)}/20.0 pace) · ${correct}/${total}`;
    scoreText = `NEC ${sectionScore.toFixed(1)}/${sec.maxScore.toFixed(1)} (${examPaceScore.toFixed(1)}/20) · ${correct}/${total}`;
  } else if (examId === 'hsg') {
    headline = `${sectionScore.toFixed(1)} / ${sec.maxScore.toFixed(1)} pts (${examPaceScore.toFixed(1)}/20.0 pace) · ${correct}/${total}`;
    scoreText = `HSG ${sectionScore.toFixed(1)}/${sec.maxScore.toFixed(1)} (${examPaceScore.toFixed(1)}/20) · ${correct}/${total}`;
  } else {
    headline = `${sectionScore} / ${sec.maxScore} pts (${examPaceScore}/100 pace) · ${correct}/${total}`;
    scoreText = `OLY ${sectionScore}/${sec.maxScore} (${examPaceScore}/100) · ${correct}/${total}`;
  }

  return {
    examId,
    sectionKey,
    sectionScore,
    examPaceScore,
    headline,
    sectionBadge: `${cfg.short} · ${sec.shortLabel}`,
    scoreText: scoreText.slice(0, 64),
    compatBand,
  };
}

/**
 * Formats a rubric-scored (Writing / Speaking) attempt in the exam's own native scale.
 * Note: qualityRatio is derived directly from rubric fulfillment (0..1), NOT converted from IELTS Band.
 */
export function buildNativeRubricScore(
  examId: ExamId,
  sectionKey: string,
  qualityRatio: number,
  ieltsBandExact: number,
  detailSuffix: string
): NativeScorePayload {
  const cfg = EXAM_CONFIGS[examId];
  const sec = getExamSection(examId, sectionKey);
  const ratio = Math.max(0, Math.min(1, qualityRatio));
  const sectionScore = examId === 'ielts' ? roundHalf(ieltsBandExact) : scoreRatioToSectionScore(examId, sectionKey, ratio);
  const examPaceScore = examId === 'ielts' ? roundHalf(ieltsBandExact) : scoreRatioToExamPace(examId, ratio);
  const compatBand = examId === 'ielts' ? sectionScore : roundTenth(Math.min(9.0, Math.max(0.0, ratio * 9.0)));

  let headline = '';
  let scoreText = '';

  if (examId === 'ielts') {
    headline = `Overall ${sec.shortLabel} Band ${sectionScore.toFixed(1)}`;
    scoreText = `IELTS Band ${sectionScore.toFixed(1)} · ${detailSuffix}`;
  } else if (examId === 'nec') {
    headline = `${sec.shortLabel}: ${sectionScore.toFixed(1)} / ${sec.maxScore.toFixed(1)} pts (${examPaceScore.toFixed(1)} / 20.0 pace)`;
    scoreText = `NEC ${sectionScore.toFixed(1)}/${sec.maxScore.toFixed(1)} (${examPaceScore.toFixed(1)}/20) · ${detailSuffix}`;
  } else if (examId === 'hsg') {
    headline = `${sec.shortLabel}: ${sectionScore.toFixed(1)} / ${sec.maxScore.toFixed(1)} pts (${examPaceScore.toFixed(1)} / 20.0 pace)`;
    scoreText = `HSG ${sectionScore.toFixed(1)}/${sec.maxScore.toFixed(1)} (${examPaceScore.toFixed(1)}/20) · ${detailSuffix}`;
  } else if (examId === 'olympic304') {
    headline = `${sec.shortLabel}: ${sectionScore} / ${sec.maxScore} pts (${examPaceScore} / 100 pace)`;
    scoreText = `OLY ${sectionScore}/${sec.maxScore} (${examPaceScore}/100) · ${detailSuffix}`;
  } else {
    headline = `${sec.shortLabel}: ${sectionScore} / 800`;
    scoreText = `SAT ${sec.shortLabel} ${sectionScore}/800 · ${detailSuffix}`;
  }

  return {
    examId,
    sectionKey,
    sectionScore,
    examPaceScore,
    headline,
    sectionBadge: `${cfg.short} · ${sec.shortLabel}`,
    scoreText: scoreText.slice(0, 64),
    compatBand,
  };
}

/**
 * Deterministically classifies any AttemptRecord (new or legacy from Firestore) to its exact
 * standardized exam and native section — ensuring zero cross-exam contamination.
 */
export function classifyAttempt(attempt: AttemptRecord): ClassifiedAttempt {
  const id = (attempt.testId || '').toLowerCase();
  const title = (attempt.testTitle || '').toLowerCase();
  const score = (attempt.scoreText || '').toLowerCase();
  const summary = (attempt.summary || '').toLowerCase();
  const combined = `${id} ${title} ${score} ${summary}`;

  let examId: ExamId = 'ielts';
  let sectionKey: string = attempt.skill;

  if (id.startsWith('sat') || score.startsWith('sat ') || /\bdigital sat\b|\bsat\b/.test(combined)) {
    examId = 'sat';
    sectionKey =
      id.includes('math') || score.includes('math') || /\bmath\b|algebra|desmos/.test(combined)
        ? 'math'
        : 'rw';
  } else if (
    id.startsWith('oly') ||
    score.startsWith('oly ') ||
    /olympic\s*30\/4|olympic 30/.test(combined)
  ) {
    examId = 'olympic304';
    if (id.includes('mcq') || score.includes('mcq')) sectionKey = 'mcq';
    else if (id.includes('cloze') || id.includes('word')) sectionKey = 'cloze';
    else if (attempt.skill === 'writing' || id.includes('-w') || /transform/.test(combined)) sectionKey = 'transform';
    else sectionKey = 'reading';
  } else if (id.startsWith('hsg') || score.startsWith('hsg ') || /\bhsg tỉnh\b|\bhsg tiếng anh\b|\bgifted round 2\b/.test(combined)) {
    examId = 'hsg';
    if (attempt.skill === 'listening' || id.includes('-l')) sectionKey = 'listening';
    else if (attempt.skill === 'writing' || id.includes('-w')) sectionKey = 'writing';
    else if (attempt.skill === 'speaking' || id.includes('-s')) sectionKey = 'speaking';
    else if (id.includes('lex') || id.includes('r1') || /lexico|phonology/.test(combined)) sectionKey = 'lexico';
    else sectionKey = 'reading';
  } else if (
    id.startsWith('nec') ||
    id === 'mock-s2' ||
    id === 'mock-r2' ||
    score.startsWith('nec ') ||
    /\bnec\b|\bhsgqg\b/.test(combined)
  ) {
    examId = 'nec';
    if (attempt.skill === 'listening' || id.includes('-l')) sectionKey = 'listening';
    else if (attempt.skill === 'writing' || id.includes('-w')) sectionKey = 'writing';
    else if (attempt.skill === 'speaking' || id.includes('-s') || id === 'mock-s2') sectionKey = 'speaking';
    else if (id.includes('rc') || /reading comprehension/.test(combined)) sectionKey = 'reading';
    else sectionKey = 'lexico';
  } else {
    examId = 'ielts';
    sectionKey = attempt.skill;
  }

  const cfg = EXAM_CONFIGS[examId];
  const sec = getExamSection(examId, sectionKey);

  // Extract native score directly from scoreText when present
  let ratio = Math.max(0, Math.min(1, (Number(attempt.band) || 0) / 9.0));
  let sectionScore: number | null = null;
  let examPaceScore: number | null = null;

  const satSecMatch = attempt.scoreText.match(/(\d{3})\s*\/\s*800/);
  const necHsgSecMatch = attempt.scoreText.match(/(?:NEC|HSG)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i);
  const pace20Match = attempt.scoreText.match(/(\d+(?:\.\d+)?)\s*\/\s*20(?:\.0)?/);
  const olySecMatch = attempt.scoreText.match(/OLY\s+(\d+)\s*\/\s*(\d+)/i);
  const pace100Match = attempt.scoreText.match(/(\d+)\s*\/\s*100/);
  const fracMatch = attempt.scoreText.match(/(\d+)\s*\/\s*(\d+)(?:\s*correct)?\b/i);

  if (examId === 'ielts') {
    const b = roundHalf(Math.min(9.0, Math.max(0.0, Number(attempt.band) || 0)));
    sectionScore = b;
    examPaceScore = b;
    ratio = b / 9.0;
  } else if (examId === 'sat') {
    if (satSecMatch) {
      sectionScore = Math.min(800, Math.max(200, roundTen(Number(satSecMatch[1]))));
      ratio = (sectionScore - 200) / 600;
      examPaceScore = Math.min(1600, Math.max(400, sectionScore * 2));
    } else if (fracMatch && Number(fracMatch[2]) > 0 && Number(fracMatch[2]) <= 60) {
      ratio = Math.min(1, Number(fracMatch[1]) / Number(fracMatch[2]));
      sectionScore = scoreRatioToSectionScore('sat', sectionKey, ratio);
      examPaceScore = scoreRatioToExamPace('sat', ratio);
    } else {
      sectionScore = scoreRatioToSectionScore('sat', sectionKey, ratio);
      examPaceScore = scoreRatioToExamPace('sat', ratio);
    }
  } else if (examId === 'nec' || examId === 'hsg') {
    if (necHsgSecMatch && Number(necHsgSecMatch[2]) > 0) {
      const num = Number(necHsgSecMatch[1]);
      const den = Number(necHsgSecMatch[2]);
      ratio = Math.min(1, Math.max(0, num / den));
      sectionScore = Math.min(sec.maxScore, roundTenth(ratio * sec.maxScore));
      examPaceScore = pace20Match ? Math.min(20.0, roundTenth(Number(pace20Match[1]))) : scoreRatioToExamPace(examId, ratio);
    } else if (pace20Match) {
      examPaceScore = Math.min(20.0, Math.max(0, roundTenth(Number(pace20Match[1]))));
      ratio = examPaceScore / 20.0;
      sectionScore = scoreRatioToSectionScore(examId, sectionKey, ratio);
    } else if (fracMatch && Number(fracMatch[2]) > 0 && Number(fracMatch[2]) <= 60) {
      ratio = Math.min(1, Number(fracMatch[1]) / Number(fracMatch[2]));
      sectionScore = scoreRatioToSectionScore(examId, sectionKey, ratio);
      examPaceScore = scoreRatioToExamPace(examId, ratio);
    } else {
      sectionScore = scoreRatioToSectionScore(examId, sectionKey, ratio);
      examPaceScore = scoreRatioToExamPace(examId, ratio);
    }
  } else {
    // olympic304
    if (olySecMatch && Number(olySecMatch[2]) > 0) {
      const num = Number(olySecMatch[1]);
      const den = Number(olySecMatch[2]);
      ratio = Math.min(1, Math.max(0, num / den));
      sectionScore = Math.min(sec.maxScore, Math.round(ratio * sec.maxScore));
      examPaceScore = pace100Match ? Math.min(100, Math.round(Number(pace100Match[1]))) : scoreRatioToExamPace('olympic304', ratio);
    } else if (pace100Match) {
      examPaceScore = Math.min(100, Math.max(0, Math.round(Number(pace100Match[1]))));
      ratio = examPaceScore / 100;
      sectionScore = scoreRatioToSectionScore('olympic304', sectionKey, ratio);
    } else if (fracMatch && Number(fracMatch[2]) > 0 && Number(fracMatch[2]) <= 100) {
      ratio = Math.min(1, Number(fracMatch[1]) / Number(fracMatch[2]));
      sectionScore = scoreRatioToSectionScore('olympic304', sectionKey, ratio);
      examPaceScore = scoreRatioToExamPace('olympic304', ratio);
    } else {
      sectionScore = scoreRatioToSectionScore('olympic304', sectionKey, ratio);
      examPaceScore = scoreRatioToExamPace('olympic304', ratio);
    }
  }

  return {
    attempt,
    examId,
    sectionKey: sec.key,
    sectionLabel: sec.shortLabel,
    ratio,
    sectionScore: sectionScore ?? 0,
    examPaceScore: examPaceScore ?? 0,
    nativeScoreLabel: cfg.formatScore(examPaceScore ?? 0),
    nativeSectionLabel: cfg.formatSectionScore(sec, sectionScore ?? 0),
  };
}

function readStoredExamGoals(): Partial<Record<ExamId, ExamGoal>> {
  try {
    const raw = window.localStorage.getItem(EXAM_GOALS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getExamGoal(examId: ExamId, profile?: UserProfile | null): ExamGoal {
  const cfg = EXAM_CONFIGS[examId];
  const stored = readStoredExamGoals();
  const saved = stored[examId];

  if (examId === 'ielts') {
    const target =
      profile && typeof profile.targetBand === 'number'
        ? profile.targetBand
        : saved && typeof saved.target === 'number'
          ? saved.target
          : cfg.defaultTarget;
    const examDate =
      (profile && profile.examDate) || (saved && saved.examDate) || '2026-12-20';
    return { target, examDate };
  }

  const defaultDate = (profile && profile.examDate) || '2026-12-20';
  if (saved && typeof saved.target === 'number' && Number.isFinite(saved.target)) {
    return {
      target: Math.min(cfg.max, Math.max(cfg.min, saved.target)),
      examDate: saved.examDate || defaultDate,
    };
  }
  return {
    target: cfg.defaultTarget,
    examDate: defaultDate,
  };
}

export function saveExamGoalLocal(examId: ExamId, target: number, examDate: string): ExamGoal {
  const cfg = EXAM_CONFIGS[examId];
  const clamped = Math.min(cfg.max, Math.max(cfg.min, target));
  const nextGoal: ExamGoal = {
    target:
      examId === 'ielts'
        ? roundHalf(clamped)
        : examId === 'sat'
          ? roundTen(clamped)
          : examId === 'olympic304'
            ? Math.round(clamped)
            : roundTenth(clamped),
    examDate: examDate || '2026-12-20',
  };
  try {
    const all = readStoredExamGoals();
    all[examId] = nextGoal;
    window.localStorage.setItem(EXAM_GOALS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return nextGoal;
}

export function getStoredFocusExam(): ExamId {
  try {
    const raw = window.localStorage.getItem('ieafl.focusExam');
    if (isValidExamId(raw)) return raw;
  } catch {
    // ignore
  }
  return 'ielts';
}

export function setStoredFocusExam(examId: ExamId): void {
  try {
    window.localStorage.setItem('ieafl.focusExam', examId);
  } catch {
    // ignore
  }
}

/**
 * Computes an isolated, native-scale monthly forecast and section breakdown for a SINGLE exam.
 * Never translates or leaks attempts from other standardized exams.
 */
export function computeExamForecast(
  examId: ExamId,
  allAttempts: AttemptRecord[],
  profile: UserProfile | null,
  localRoadmapCount = 0
): ExamForecast {
  const cfg = EXAM_CONFIGS[examId];
  const goal = getExamGoal(examId, profile);
  const roadmapDone =
    profile && Array.isArray(profile.completedRoadmapSteps)
      ? profile.completedRoadmapSteps.length
      : localRoadmapCount;

  const classifiedAll = allAttempts.map(classifyAttempt);
  const examAttempts = classifiedAll.filter((c) => c.examId === examId);

  const now = new Date();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const attemptsThisMonth = examAttempts.filter((c) => (c.attempt.createdAtMs || 0) >= monthStart).length;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(`${goal.examDate}T00:00:00`).getTime() - Date.now()) / 86400000)
  );

  // Build isolated section breakdown ONLY for this exam's native sections
  const sectionRows: SectionReadinessRow[] = cfg.sections.map((section) => {
    const matching = examAttempts.filter((c) => c.sectionKey === section.key);
    const practiceHref = `#/workspace/${section.workspaceTab}?exam=${examId}&section=${section.key}&test=${section.defaultTestId}`;
    if (matching.length === 0) {
      return {
        section,
        attemptsCount: 0,
        avgSectionScore: null,
        bestSectionScore: null,
        avgRatio: null,
        fillPct: 0,
        displayValue: 'No attempts yet',
        bestDisplayValue: 'No attempts yet',
        practiceHref,
      };
    }

    const avgRaw = matching.reduce((s, c) => s + c.sectionScore, 0) / matching.length;
    const bestRaw = Math.max(...matching.map((c) => c.sectionScore));
    const avgRatio = matching.reduce((s, c) => s + c.ratio, 0) / matching.length;

    let avgSectionScore: number;
    let bestSectionScore: number;
    if (section.unit === 'band') {
      avgSectionScore = roundHalf(avgRaw);
      bestSectionScore = roundHalf(bestRaw);
    } else if (section.unit === 'sat_section') {
      avgSectionScore = roundTen(avgRaw);
      bestSectionScore = roundTen(bestRaw);
    } else if (section.unit === 'pts20') {
      avgSectionScore = roundTenth(avgRaw);
      bestSectionScore = roundTenth(bestRaw);
    } else {
      avgSectionScore = Math.round(avgRaw);
      bestSectionScore = Math.round(bestRaw);
    }

    const span = Math.max(1, section.maxScore - section.minScore);
    const fillPct = Math.max(6, Math.min(100, Math.round(((avgSectionScore - section.minScore) / span) * 100)));

    return {
      section,
      attemptsCount: matching.length,
      avgSectionScore,
      bestSectionScore,
      avgRatio,
      fillPct,
      displayValue: cfg.formatSectionScore(section, avgSectionScore),
      bestDisplayValue: `Best ${cfg.formatSectionScore(section, bestSectionScore)}`,
      practiceHref,
    };
  });

  const loggedSections = sectionRows.filter((r) => r.avgSectionScore !== null);
  const hasData = loggedSections.length > 0;

  let currentScore: number | null = null;
  let projectedScore: number | null = null;
  let deltaToGoal: number | null = null;
  let verdict = '';
  let weeks: Array<{ label: string; val: number }> = [];

  if (!hasData) {
    verdict = `No ${cfg.short} attempts logged yet — complete any ${cfg.short} section below to establish your native ${cfg.scaleName} baseline.`;
    weeks = [
      { label: 'Wk 1 · Now', val: goal.target },
      { label: 'Wk 2', val: goal.target },
      { label: 'Wk 3', val: goal.target },
      { label: 'Wk 4 · End', val: goal.target },
    ];
  } else {
    // Compute authentic overall current score strictly from this exam's logged sections
    if (examId === 'ielts') {
      const avg =
        loggedSections.reduce((sum, r) => sum + (r.avgSectionScore || 0), 0) / loggedSections.length;
      currentScore = roundHalf(avg);
      const boost = Math.min(1.0, attemptsThisMonth * 0.15 + (roadmapDone / 24) * 0.5 + 0.25);
      projectedScore = roundHalf(Math.min(9.0, Math.min(goal.target + 0.5, currentScore + boost)));
      weeks = [
        { label: 'Wk 1 · Now', val: currentScore },
        { label: 'Wk 2', val: roundHalf(currentScore + (projectedScore - currentScore) * 0.35) },
        { label: 'Wk 3', val: roundHalf(currentScore + (projectedScore - currentScore) * 0.7) },
        { label: 'Wk 4 · End', val: projectedScore },
      ];
    } else if (examId === 'sat') {
      const rw = sectionRows.find((r) => r.section.key === 'rw')?.avgSectionScore ?? null;
      const math = sectionRows.find((r) => r.section.key === 'math')?.avgSectionScore ?? null;
      if (rw !== null && math !== null) {
        currentScore = roundTen(rw + math);
      } else {
        const only = rw ?? math ?? 500;
        currentScore = roundTen(only * 2);
      }
      const boost = roundTen(Math.min(100, attemptsThisMonth * 20 + (roadmapDone / 24) * 40 + 20));
      projectedScore = roundTen(Math.min(1600, Math.min(goal.target + 40, currentScore + boost)));
      weeks = [
        { label: 'Wk 1 · Now', val: currentScore },
        { label: 'Wk 2', val: roundTen(currentScore + (projectedScore - currentScore) * 0.35) },
        { label: 'Wk 3', val: roundTen(currentScore + (projectedScore - currentScore) * 0.7) },
        { label: 'Wk 4 · End', val: projectedScore },
      ];
    } else if (examId === 'nec' || examId === 'hsg') {
      // Weighted ratio across attempted sections projected onto the full 20.0 scale
      let earnedWeight = 0;
      let totalWeight = 0;
      loggedSections.forEach((r) => {
        earnedWeight += r.avgSectionScore || 0;
        totalWeight += r.section.maxScore;
      });
      const weightedRatio = totalWeight > 0 ? earnedWeight / totalWeight : 0;
      currentScore = roundTenth(Math.min(20.0, weightedRatio * 20.0));
      const boost = roundTenth(Math.min(1.8, attemptsThisMonth * 0.3 + (roadmapDone / 24) * 0.8 + 0.3));
      projectedScore = roundTenth(Math.min(20.0, Math.min(goal.target + 0.8, currentScore + boost)));
      weeks = [
        { label: 'Wk 1 · Now', val: currentScore },
        { label: 'Wk 2', val: roundTenth(currentScore + (projectedScore - currentScore) * 0.35) },
        { label: 'Wk 3', val: roundTenth(currentScore + (projectedScore - currentScore) * 0.7) },
        { label: 'Wk 4 · End', val: projectedScore },
      ];
    } else {
      // olympic304 (/100)
      let earnedPts = 0;
      let possiblePts = 0;
      loggedSections.forEach((r) => {
        earnedPts += r.avgSectionScore || 0;
        possiblePts += r.section.maxScore;
      });
      const weightedRatio = possiblePts > 0 ? earnedPts / possiblePts : 0;
      currentScore = Math.min(100, Math.round(weightedRatio * 100));
      const boost = Math.round(Math.min(10, attemptsThisMonth * 2 + (roadmapDone / 24) * 4 + 2));
      projectedScore = Math.min(100, Math.min(goal.target + 4, currentScore + boost));
      weeks = [
        { label: 'Wk 1 · Now', val: currentScore },
        { label: 'Wk 2', val: Math.round(currentScore + (projectedScore - currentScore) * 0.35) },
        { label: 'Wk 3', val: Math.round(currentScore + (projectedScore - currentScore) * 0.7) },
        { label: 'Wk 4 · End', val: projectedScore },
      ];
    }

    deltaToGoal =
      examId === 'ielts'
        ? roundHalf(projectedScore - goal.target)
        : examId === 'sat'
          ? roundTen(projectedScore - goal.target)
          : examId === 'olympic304'
            ? Math.round(projectedScore - goal.target)
            : roundTenth(projectedScore - goal.target);

    if (deltaToGoal >= 0) {
      verdict = `On track for ${cfg.formatScore(projectedScore)} (${cfg.formatDelta(deltaToGoal)} vs your ${cfg.formatScore(goal.target)} goal) by end of ${monthName}.`;
    } else {
      verdict = `Projected ${cfg.formatScore(projectedScore)} this month (${cfg.formatDelta(Math.abs(deltaToGoal)).replace(/^\+/, '')} below ${cfg.formatScore(goal.target)} goal — log 2+ timed ${cfg.short} mocks to close the gap).`;
    }

    if (examId === 'sat' && loggedSections.length === 1) {
      verdict += ` Based on ${loggedSections[0].section.shortLabel} pace — log ${loggedSections[0].section.key === 'rw' ? 'Math' : 'Reading & Writing'} for a full 1600 composite.`;
    }
  }

  return {
    examId,
    config: cfg,
    monthName,
    target: goal.target,
    examDate: goal.examDate,
    daysLeft,
    roadmapDone,
    totalExamAttempts: examAttempts.length,
    attemptsThisMonth,
    sectionsLoggedCount: loggedSections.length,
    hasData,
    currentScore,
    projectedScore,
    deltaToGoal,
    verdict,
    weeks,
    sectionRows,
    examAttempts,
  };
}
