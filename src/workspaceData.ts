import type { SkillId } from './firebase';
import type { ExamId } from './examScoring';

export interface ReadingParagraph {
  label: string;
  text: string;
}

export interface ReadingQuestion {
  id: string;
  num: number;
  type: 'tfng' | 'mc' | 'heading' | 'completion';
  prompt: string;
  options?: string[];
  answer: string;
  evidenceParagraph: string;
  explanation: string;
}

export interface ReadingTest {
  id: string;
  examId: ExamId;
  sectionKey: string;
  isMock?: boolean;
  source: string;
  title: string;
  subtitle: string;
  durationSec: number;
  paragraphs: ReadingParagraph[];
  questions: ReadingQuestion[];
}

export interface ListeningCue {
  speaker: string;
  voiceRole: 'host' | 'guest' | 'lecturer';
  text: string;
  highlightPhrase?: string;
}

export interface ListeningQuestion {
  id: string;
  num: number;
  type: 'completion' | 'mc';
  prompt: string;
  wordLimit?: string;
  options?: string[];
  answers: string[];
  explanation: string;
}

export interface ListeningTest {
  id: string;
  examId: ExamId;
  sectionKey: string;
  isMock?: boolean;
  source: string;
  partLabel: string;
  title: string;
  instructions: string;
  durationSec: number;
  cues: ListeningCue[];
  questions: ListeningQuestion[];
}

export interface WritingPrompt {
  id: string;
  examId: ExamId;
  sectionKey: string;
  isMock?: boolean;
  task: 'task1' | 'task2';
  source: string;
  title: string;
  durationSec: number;
  minWords: number;
  prompt: string;
  tableData?: {
    caption: string;
    headers: string[];
    rows: Array<Array<string | number>>;
  };
}

export interface SpeakingTurn {
  part: 1 | 2 | 3;
  label: string;
  prompt: string;
  cueCardBullets?: string[];
  prepSec?: number;
  speakSec: number;
}

export interface SpeakingTest {
  id: string;
  examId: ExamId;
  sectionKey: string;
  isMock?: boolean;
  examMode?: 'ielts' | 'nec' | 'hsg';
  source: string;
  title: string;
  turns: SpeakingTurn[];
}

export const READING_TESTS: ReadingTest[] = [
  {
    id: 'mock-r1',
    examId: 'ielts',
    sectionKey: 'reading',
    isMock: true,
    source: '[MOCK EXAM 01] IELTS Academic Reading',
    title: 'Bioluminescent Streetlights & Microbial Architecture',
    subtitle: 'Full Sandbox Mock · 8 Exam Questions (TFNG, Headings, Multiple Choice, Completion)',
    durationSec: 1200,
    paragraphs: [
      {
        label: 'A',
        text: 'Municipal street lighting accounts for nearly nineteen percent of global electricity consumption, prompting urban engineers to search for passive biological alternatives. In coastal pilot zones of France and the Netherlands, designers have begun encasing bioluminescent marine bacteria—primarily Aliivibrio fischeri—inside sealed glass tubes that emit a soft turquoise glow without external wiring.'
      },
      {
        label: 'B',
        text: 'Unlike conventional LEDs, bacterial lamps do not generate intense point-source glare that disrupts nocturnal pollinators or human circadian rhythms. Photometric trials in Rambouillet demonstrated that bioluminescent bollards illuminate pedestrian footpaths clearly while cutting upward skyglow by more than seventy percent compared with standard sodium-vapour fixtures.'
      },
      {
        label: 'C',
        text: 'Scaling living light from gallery installations to municipal streets, however, presents formidable biological hurdles. The bacteria require steady nutrient broth and temperatures above eight degrees Celsius to sustain luminescence; during winter cold snaps, colonies rapidly dim unless insulated with phase-change thermal gels.'
      },
      {
        label: 'D',
        text: 'To extend operational lifespans beyond seventy-two hours, biotechnology startups now circulate liquid nutrients through closed-loop micro-pumps powered by small photovoltaic caps. Every four weeks, technicians flush spent biomass and repurpose it as nitrogen-rich agricultural fertiliser, turning maintenance into a circular resource cycle.'
      },
      {
        label: 'E',
        text: 'Urban lighting specialists caution that living lamps will not replace high-output highway floodlights anytime soon. Rather, their niche lies in historic plazas, botanical parks, and waterfront promenades where atmospheric wayfinding matters more than blinding luminance.'
      }
    ],
    questions: [
      {
        id: 'mq1',
        num: 1,
        type: 'tfng',
        prompt: 'Municipal street lighting represents almost one-fifth of worldwide electrical power usage.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'TRUE',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A notes street lighting accounts for "nearly nineteen percent of global electricity consumption."'
      },
      {
        id: 'mq2',
        num: 2,
        type: 'tfng',
        prompt: 'Bioluminescent bollards in Rambouillet produced more upward skyglow than traditional sodium-vapour lamps.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B states the bollards cut upward skyglow by more than 70% compared with standard sodium-vapour fixtures.'
      },
      {
        id: 'mq3',
        num: 3,
        type: 'tfng',
        prompt: 'The Netherlands has already replaced half of its national highway lamps with bacterial tubes.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'NOT GIVEN',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A mentions coastal pilot zones in the Netherlands, while Paragraph E notes living lamps will not replace highway floodlights soon.'
      },
      {
        id: 'mq4',
        num: 4,
        type: 'heading',
        prompt: 'Choose the best heading for Paragraph C:',
        options: [
          'i. Environmental and thermal limits of living lamps',
          'ii. Why solar micro-pumps fail in coastal cities',
          'iii. Turning bacterial waste into farm fertiliser',
          'iv. Early history of sodium-vapour street lighting'
        ],
        answer: 'i. Environmental and thermal limits of living lamps',
        evidenceParagraph: 'C',
        explanation: 'Paragraph C details the nutrient requirements and winter temperature drop below 8°C that dim bacterial colonies.'
      },
      {
        id: 'mq5',
        num: 5,
        type: 'mc',
        prompt: 'What happens to the spent bacterial biomass collected during monthly maintenance?',
        options: [
          'A. It is incinerated in municipal plants.',
          'B. It is reused as nitrogen-rich fertiliser for agriculture.',
          'C. It is mixed into phase-change thermal gels.',
          'D. It is discharged directly into coastal seawater.'
        ],
        answer: 'B. It is reused as nitrogen-rich fertiliser for agriculture.',
        evidenceParagraph: 'D',
        explanation: 'Paragraph D explains technicians flush spent biomass every four weeks and repurpose it as nitrogen-rich agricultural fertiliser.'
      },
      {
        id: 'mq6',
        num: 6,
        type: 'mc',
        prompt: 'According to Paragraph E, where are bioluminescent lamps most suitable?',
        options: [
          'A. High-speed motorway interchanges',
          'B. Underground subway tunnels',
          'C. Historic plazas, parks, and waterfront promenades',
          'D. Industrial shipping ports'
        ],
        answer: 'C. Historic plazas, parks, and waterfront promenades',
        evidenceParagraph: 'E',
        explanation: 'Paragraph E specifies their niche is historic plazas, botanical parks, and waterfront promenades.'
      },
      {
        id: 'mq7',
        num: 7,
        type: 'completion',
        prompt: 'ONE WORD ONLY: Bacterial lamps emit a gentle ________ glow without needing external electrical wiring.',
        answer: 'turquoise',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A describes sealed glass tubes that "emit a soft turquoise glow without external wiring."'
      },
      {
        id: 'mq8',
        num: 8,
        type: 'completion',
        prompt: 'ONE WORD ONLY: Closed-loop micro-pumps are driven by compact ________ caps mounted on the lamps.',
        answer: 'photovoltaic',
        evidenceParagraph: 'D',
        explanation: 'Paragraph D states liquid nutrients circulate through micro-pumps "powered by small photovoltaic caps."'
      }
    ]
  },
  {
    id: 'nec25-rc1',
    examId: 'nec',
    sectionKey: 'reading',
    isMock: true,
    source: 'NEC (HSGQG) · Part C Reading & Open Cloze',
    title: 'Cognitive Offloading, Archival Audits & Cloze Synthesis',
    subtitle: 'NEC Part C (5.0 / 20.0 pts) · 5 C1–C2 Reading & Open Cloze Questions',
    durationSec: 900,
    paragraphs: [
      {
        label: 'A',
        text: 'Psychologists define cognitive offloading as relying on external tools—calendars, GPS routes, or searchable notes—to reduce working-memory load. Far from uniformly weakening recall, controlled experiments indicate that offloading trivial logistics frees executive attention for complex synthesis, provided learners still retrieve core concepts actively.'
      },
      {
        label: 'B',
        text: 'NEC Open Cloze & Word Formation excerpt: Had the committee reviewed the acoustic audit earlier, the auditorium’s reverberation flaw would never have (1) ________ [MATERIAL] into a multi-million-dollar delay. Rarely (2) ________ municipal architects faced such intense public scrutiny over a single ceiling baffle.'
      },
      {
        label: 'C',
        text: 'Critics of unchecked digital delegation warn that when students outsource every stage of summarization to automated notebooks, they forfeit the "desirable difficulty" of retrieval practice. Empirical classroom trials confirm that learners who draft brief memory-first outlines before consulting external archives retain conceptual links far longer than peers who rely on passive lookups.'
      }
    ],
    questions: [
      {
        id: 'mr2q1',
        num: 1,
        type: 'mc',
        prompt: '[NEC Reading · Inference] According to Paragraph A, when does cognitive offloading benefit learners?',
        options: [
          'A. When learners stop retrieving core concepts altogether',
          'B. When offloading routine logistics frees attention while learners still actively recall key concepts',
          'C. Only when paper calendars replace digital GPS maps',
          'D. Whenever working memory is completely bypassed during exams'
        ],
        answer: 'B. When offloading routine logistics frees attention while learners still actively recall key concepts',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A states offloading trivial logistics frees executive attention "provided learners still retrieve core concepts actively."'
      },
      {
        id: 'mr2q2',
        num: 2,
        type: 'completion',
        prompt: '[NEC Word Formation · ONE WORD] Transform [MATERIAL] for blank (1) in Paragraph B: "...would never have ________ into a multi-million-dollar delay."',
        answer: 'materialized',
        evidenceParagraph: 'B',
        explanation: 'Past participle after "would never have" requires "materialized" (meaning developed into an actual problem).'
      },
      {
        id: 'mr2q3',
        num: 3,
        type: 'completion',
        prompt: '[NEC Open Cloze · ONE WORD] Fill blank (2) in Paragraph B using negative inversion: "Rarely ________ municipal architects faced such intense public scrutiny..."',
        answer: 'have',
        evidenceParagraph: 'B',
        explanation: 'Plural subject "municipal architects" + past participle "faced" after fronted negative adverb "Rarely" requires auxiliary "have."'
      },
      {
        id: 'mr2q4',
        num: 4,
        type: 'tfng',
        prompt: 'Controlled studies in Paragraph A prove that using digital notes always harms long-term human memory.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A explicitly says "Far from uniformly weakening recall," offloading can free executive attention.'
      },
      {
        id: 'mr2q5',
        num: 5,
        type: 'completion',
        prompt: '[NEC Reading · ONE WORD] According to Paragraph C, outsourcing every stage of summarization deprives students of "desirable ________" during retrieval.',
        answer: 'difficulty',
        evidenceParagraph: 'C',
        explanation: 'Paragraph C warns students forfeit the "desirable difficulty" of retrieval practice.'
      }
    ]
  },
  {
    id: 'cam20-r1',
    examId: 'ielts',
    sectionKey: 'reading',
    source: 'Cambridge IELTS 20 · Reading Passage 1',
    title: 'Urban Microclimates & Vertical Canopy',
    subtitle: 'Academic Reading · 8 Exam Questions (TFNG, Matching Headings, MC, Summary Completion)',
    durationSec: 1200,
    paragraphs: [
      {
        label: 'A',
        text: 'As dense metropolitan districts replace permeable soil with asphalt and glazed facades, daytime surfaces absorb solar radiation and release it slowly after sunset. Meteorologists call this phenomenon the urban heat island effect, which routinely elevates nocturnal city temperatures by three to five degrees Celsius compared with surrounding rural basins. While reflective roof coatings mitigate direct absorption, municipal planners increasingly view multi-layered vegetation as a more durable thermal buffer.'
      },
      {
        label: 'B',
        text: 'In Singapore and Milan, architects have pioneered vertical forests—high-rise residential towers whose cantilevered balconies support hundreds of mature shrubs and medium-sized trees. Early sceptics warned that irrigated soil troughs would overload structural slabs and demand prohibitive maintenance budgets. However, ten-year engineering audits in Milan revealed that reinforced concrete decks experienced negligible fatigue, while residents reported a thirty-percent reduction in summer air-conditioning demand.'
      },
      {
        label: 'C',
        text: 'Beyond cooling interior rooms, vertical foliage alters street-level aerodynamics and acoustic profiles. Dense leaf canopies break up downdraughts that normally funnel wind aggressively around glass skyscrapers, creating calmer pedestrian plazas below. Simultaneously, porous soil beds and irregular leaf surfaces scatter low-frequency traffic rumble, trimming ambient street noise by up to six decibels along busy arterial corridors.'
      },
      {
        label: 'D',
        text: 'Nevertheless, ecological benefits do not emerge automatically from planting greenery on concrete. Botanists emphasize that species selection dictates survival rates: wind-exposed upper storeys suffer rapid moisture loss, killing ornamental plants native to sheltered valleys. Successful projects pair drought-tolerant native species with automated drip irrigation fed by harvested rainwater, eliminating reliance on potable municipal water supplies.'
      },
      {
        label: 'E',
        text: 'Critics still question whether luxury green towers address urban equity. Because structural reinforcement raises initial construction outlays by roughly five percent, early developments have predominantly served affluent buyers rather than public housing estates. Recent pilot schemes in Rotterdam and Vienna aim to reverse that imbalance by retrofitting modular steel trellises onto existing social housing blocks at a fraction of new-build costs.'
      }
    ],
    questions: [
      {
        id: 'q1',
        num: 1,
        type: 'tfng',
        prompt: 'The urban heat island effect causes nighttime temperatures in cities to be noticeably warmer than nearby countryside.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'TRUE',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A states the effect "routinely elevates nocturnal city temperatures by three to five degrees Celsius compared with surrounding rural basins."'
      },
      {
        id: 'q2',
        num: 2,
        type: 'tfng',
        prompt: 'Ten-year inspections in Milan confirmed that irrigated balconies caused severe structural damage to concrete slabs.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B contradicts this directly: ten-year audits revealed that reinforced concrete decks "experienced negligible fatigue."'
      },
      {
        id: 'q3',
        num: 3,
        type: 'tfng',
        prompt: 'Singapore currently maintains more vertical forest towers than any other city in Southeast Asia.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'NOT GIVEN',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B mentions Singapore as a pioneer alongside Milan, but gives no regional ranking or count comparison.'
      },
      {
        id: 'q4',
        num: 4,
        type: 'heading',
        prompt: 'Choose the best heading for Paragraph C:',
        options: [
          'i. Financial barriers facing social housing upgrades',
          'ii. Wind calming and noise reduction at street level',
          'iii. Rainwater storage failures on upper balconies',
          'iv. Historical origins of reflective roof paints'
        ],
        answer: 'ii. Wind calming and noise reduction at street level',
        evidenceParagraph: 'C',
        explanation: 'Paragraph C focuses on aerodynamics (breaking up downdraughts) and acoustics (trimming ambient street noise by up to 6 dB).'
      },
      {
        id: 'q5',
        num: 5,
        type: 'heading',
        prompt: 'Choose the best heading for Paragraph D:',
        options: [
          'i. Why botanical choice and smart irrigation determine survival',
          'ii. How concrete reinforcement increases energy usage',
          'iii. Public opposition to pedestrian plazas',
          'iv. Comparing Milan and Vienna tax incentives'
        ],
        answer: 'i. Why botanical choice and smart irrigation determine survival',
        evidenceParagraph: 'D',
        explanation: 'Paragraph D explains that drought-tolerant native species paired with rainwater drip irrigation prevent upper-storey plant failure.'
      },
      {
        id: 'q6',
        num: 6,
        type: 'mc',
        prompt: 'Why have early vertical forest developments mainly attracted wealthy buyers?',
        options: [
          'A. Municipalities banned them from public land.',
          'B. Structural reinforcement adds around five percent to construction costs.',
          'C. Air-conditioning units had to be replaced every year.',
          'D. Ornamental plants required imported valley soil.'
        ],
        answer: 'B. Structural reinforcement adds around five percent to construction costs.',
        evidenceParagraph: 'E',
        explanation: 'Paragraph E notes structural reinforcement raises initial construction outlays by roughly 5%, skewing early projects toward affluent buyers.'
      },
      {
        id: 'q7',
        num: 7,
        type: 'completion',
        prompt: 'Summary Completion (ONE WORD ONLY): Successful high-rise gardens use automated drip systems supplied by collected ________ rather than municipal drinking water.',
        answer: 'rainwater',
        evidenceParagraph: 'D',
        explanation: 'Paragraph D states automated drip irrigation is "fed by harvested rainwater, eliminating reliance on potable municipal water supplies."'
      },
      {
        id: 'q8',
        num: 8,
        type: 'completion',
        prompt: 'Summary Completion (ONE WORD ONLY): Pilots in Rotterdam and Vienna lower retrofit expenses by attaching modular steel ________ to existing social housing.',
        answer: 'trellises',
        evidenceParagraph: 'E',
        explanation: 'Paragraph E explicitly states retrofitting "modular steel trellises onto existing social housing blocks."'
      }
    ]
  },
  {
    id: 'cam19-r2',
    examId: 'ielts',
    sectionKey: 'reading',
    source: 'Cambridge IELTS 19 · Reading Passage 2',
    title: 'Hydrothermal Vents & Chemosynthetic Ecosystems',
    subtitle: 'Academic Reading · 6 Exam Questions (YNNG, MC, Summary Completion)',
    durationSec: 1200,
    paragraphs: [
      {
        label: 'A',
        text: 'Until 1977, marine biologists assumed that all complex life on Earth depended ultimately on sunlight and photosynthesis. That consensus shattered when the submersible Alvin descended 2,500 metres along the Galápagos Rift and photographed dense colonies of giant tube worms thriving beside superheated mineral chimneys in pitch-black water.'
      },
      {
        label: 'B',
        text: 'Rather than harvesting solar photons, specialized microbes living inside the worms oxidize hydrogen sulfide pouring from volcanic fissures—a biochemical pathway termed chemosynthesis. Because vent plumes cool rapidly on contact with frigid abyssal seawater, ecosystems cluster within tight thermal bands just a few metres wide.'
      },
      {
        label: 'C',
        text: 'Some astrobiologists argue that hydrothermal vents offer the strongest analogue for how early life may have originated on Earth and might persist beneath the icy crusts of Europa or Enceladus. Critics caution that mineral gradients alone cannot prove biological emergence without replicating genetic self-assembly in laboratory pressure chambers.'
      }
    ],
    questions: [
      {
        id: 'q1',
        num: 1,
        type: 'tfng',
        prompt: 'Before 1977, scientists widely believed complex ecosystems required sunlight.',
        options: ['YES', 'NO', 'NOT GIVEN'],
        answer: 'YES',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A confirms biologists assumed all complex life depended ultimately on sunlight and photosynthesis until 1977.'
      },
      {
        id: 'q2',
        num: 2,
        type: 'tfng',
        prompt: 'Hydrothermal vent organisms spread evenly across hundreds of kilometres of abyssal plain.',
        options: ['YES', 'NO', 'NOT GIVEN'],
        answer: 'NO',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B states ecosystems "cluster within tight thermal bands just a few metres wide."'
      },
      {
        id: 'q3',
        num: 3,
        type: 'tfng',
        prompt: 'Space probes have already confirmed living microbes beneath the ice crust of Enceladus.',
        options: ['YES', 'NO', 'NOT GIVEN'],
        answer: 'NOT GIVEN',
        evidenceParagraph: 'C',
        explanation: 'Paragraph C only states life "might persist" beneath Europa or Enceladus; no probe confirmation is mentioned.'
      },
      {
        id: 'q4',
        num: 4,
        type: 'mc',
        prompt: 'What energy source powers the microbes living inside giant tube worms?',
        options: [
          'A. Filtered surface sunlight',
          'B. Oxidizing hydrogen sulfide from volcanic fissures',
          'C. Freezing abyssal currents',
          'D. Laboratory pressure chambers'
        ],
        answer: 'B. Oxidizing hydrogen sulfide from volcanic fissures',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B specifies microbes "oxidize hydrogen sulfide pouring from volcanic fissures."'
      },
      {
        id: 'q5',
        num: 5,
        type: 'completion',
        prompt: 'ONE WORD ONLY: The dark-ocean biochemical process that replaces photosynthesis at hydrothermal vents is called ________.',
        answer: 'chemosynthesis',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B names this biochemical pathway "chemosynthesis."'
      },
      {
        id: 'q6',
        num: 6,
        type: 'completion',
        prompt: 'ONE WORD ONLY: The research vessel that photographed the Galápagos Rift vent colonies in 1977 was named ________.',
        answer: 'Alvin',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A identifies the submersible as "Alvin."'
      }
    ]
  },
  {
    id: 'sat25-rwm1',
    examId: 'sat',
    sectionKey: 'rw',
    source: 'Digital SAT · Reading & Writing Module 1',
    title: 'SAT R&W: Craft, Structure & Standard English Conventions',
    subtitle: 'Digital SAT Reading & Writing (200–800 scale) · 4 Bluebook-Style Questions',
    durationSec: 900,
    paragraphs: [
      {
        label: 'RW1',
        text: 'Botanist Dr. Clara Osei hypothesized that alpine mosses survive winter desiccation not by thickening their cell walls, as long assumed, but by synthesizing trehalose sugars that vitrify cytoplasm into a glass-like matrix. When her team analyzed specimens from 3,400 meters, cell-wall thickness matched lowland relatives while trehalose concentrations surged twelvefold.'
      },
      {
        label: 'RW2',
        text: 'Standard English Conventions excerpt: Completed in 1931 and spanning 1,067 meters across the Hudson River, the George Washington Bridge—engineered by Othmar Ammann, whose minimalist suspension design eliminated heavy stone cladding—______ a landmark of twentieth-century structural elegance.'
      },
      {
        label: 'RW3',
        text: 'Words in Context excerpt: Early cartographers often treated ocean trenches as featureless voids, yet sonar bathymetry revealed a surprisingly ______ topography of jagged ridges, brine pools, and hydrothermal chimneys.'
      },
      {
        label: 'RW4',
        text: 'Transitions excerpt: Urban tree canopies lower afternoon pavement temperatures by shading asphalt surfaces. ______, leaf transpiration releases water vapor that cools surrounding street air even after direct sunlight shifts.'
      }
    ],
    questions: [
      {
        id: 'q1',
        num: 1,
        type: 'mc',
        prompt: '[SAT R&W · Information & Ideas] Which finding in RW1 most directly supports Dr. Osei’s hypothesis?',
        options: [
          'A. Alpine mosses had thicker cell walls than lowland species.',
          'B. Trehalose concentrations rose twelvefold while cell-wall thickness remained comparable to lowland mosses.',
          'C. Lowland mosses grew faster above 3,400 meters.',
          'D. Cytoplasm dissolved completely during winter frost.'
        ],
        answer: 'B. Trehalose concentrations rose twelvefold while cell-wall thickness remained comparable to lowland mosses.',
        evidenceParagraph: 'RW1',
        explanation: 'RW1 confirms cell-wall thickness matched lowland relatives while trehalose surged twelvefold, validating Osei’s sugar-vitrification mechanism.'
      },
      {
        id: 'q2',
        num: 2,
        type: 'mc',
        prompt: '[SAT R&W · Standard English Conventions] Which choice completes RW2 so that it conforms to Standard English conventions?',
        options: [
          'A. remaining',
          'B. have remained',
          'C. remains',
          'D. to remain'
        ],
        answer: 'C. remains',
        evidenceParagraph: 'RW2',
        explanation: 'The singular subject "the George Washington Bridge" requires a finite singular main verb ("remains") after the parenthetical em-dash modifier.'
      },
      {
        id: 'q3',
        num: 3,
        type: 'mc',
        prompt: '[SAT R&W · Words in Context] Which choice completes RW3 with the most logical and precise word?',
        options: [
          'A. uniform',
          'B. intricate',
          'C. transient',
          'D. obsolete'
        ],
        answer: 'B. intricate',
        evidenceParagraph: 'RW3',
        explanation: 'Contrast with "featureless voids" plus examples ("jagged ridges, brine pools, hydrothermal chimneys") calls for "intricate."'
      },
      {
        id: 'q4',
        num: 4,
        type: 'mc',
        prompt: '[SAT R&W · Transitions] Which choice completes RW4 with the most logical transition?',
        options: [
          'A. Nevertheless',
          'B. Instead',
          'C. Moreover',
          'D. Regardless'
        ],
        answer: 'C. Moreover',
        evidenceParagraph: 'RW4',
        explanation: 'The second sentence adds a second complementary cooling mechanism (transpiration), requiring an additive transition ("Moreover").'
      }
    ]
  },
  {
    id: 'sat25-math1',
    examId: 'sat',
    sectionKey: 'math',
    source: 'Digital SAT · Math Module 1 (Algebra & Advanced Math)',
    title: 'SAT Math: Linear Systems, Rates & Vertex Quadratics',
    subtitle: 'Digital SAT Math (200–800 scale · Desmos Allowed) · 5 Quantitative Questions',
    durationSec: 1050,
    paragraphs: [
      {
        label: 'M1',
        text: 'Linear Systems: A robotics team budgets $420 for microcontrollers ($24 each) and sensors ($12 each). They order exactly 25 components in total. Let m represent microcontrollers and s represent sensors, so m + s = 25 and 24m + 12s = 420.'
      },
      {
        label: 'M2',
        text: 'Quadratics (Vertex Form): The parabola y = a(x − 3)² + 5 passes through the point (5, 17). Determine the leading coefficient a without losing sign precision.'
      },
      {
        label: 'M3',
        text: 'Proportional Rates: A student completes 18 practice questions in 24 minutes at a constant pace, and aims to finish a 27-question adaptive module at the exact same rate.'
      },
      {
        label: 'M4',
        text: 'Linear Functions: A solar microgrid stores energy modeled by E(t) = 140 + 35t kilowatt-hours after t hours of peak sunlight. Determine how many hours t are required to reach 490 kWh.'
      }
    ],
    questions: [
      {
        id: 'sm1',
        num: 1,
        type: 'mc',
        prompt: '[SAT Math · Algebra] Based on M1, how many microcontrollers (m) did the robotics team purchase?',
        options: ['A. 8', 'B. 10', 'C. 15', 'D. 18'],
        answer: 'B. 10',
        evidenceParagraph: 'M1',
        explanation: 'Substitute s = 25 − m into 24m + 12(25 − m) = 420 → 12m + 300 = 420 → m = 10.'
      },
      {
        id: 'sm2',
        num: 2,
        type: 'completion',
        prompt: '[SAT Math · Student-Produced Response] From M1, how many sensors (s) did the team buy?',
        answer: '15',
        evidenceParagraph: 'M1',
        explanation: 'Since m = 10 and m + s = 25, s = 15 sensors.'
      },
      {
        id: 'sm3',
        num: 3,
        type: 'completion',
        prompt: '[SAT Math · Quadratics] Using M2 (y = a(x − 3)² + 5 passing through (5, 17)), enter the exact integer value of a:',
        answer: '3',
        evidenceParagraph: 'M2',
        explanation: 'Plug in (5, 17): 17 = a(5 − 3)² + 5 → 12 = 4a → a = 3.'
      },
      {
        id: 'sm4',
        num: 4,
        type: 'completion',
        prompt: '[SAT Math · Rate] From M3, at 18 questions per 24 minutes, how many minutes will 27 questions take?',
        answer: '36',
        evidenceParagraph: 'M3',
        explanation: 'Rate = 24 / 18 = 4/3 min per question. 27 × (4/3) = 36 minutes.'
      },
      {
        id: 'sm5',
        num: 5,
        type: 'completion',
        prompt: '[SAT Math · Linear Model] From M4 (E(t) = 140 + 35t), how many hours t are needed to reach 490 kWh?',
        answer: '10',
        evidenceParagraph: 'M4',
        explanation: '140 + 35t = 490 → 35t = 350 → t = 10 hours.'
      }
    ]
  },
  {
    id: 'nec25-r1',
    examId: 'nec',
    sectionKey: 'lexico',
    source: 'NEC (HSGQG) · Part B Lexico-Grammar & Word Formation',
    title: 'C1–C2 Use of English: Word Formation, Inversion & Idioms',
    subtitle: 'NEC Part B (2.0 / 20.0 pts) · 5 Competitive Lexico-Grammar Items',
    durationSec: 900,
    paragraphs: [
      {
        label: 'P1',
        text: 'Open Cloze Passage (NEC Part B): Few inventions reshaped maritime navigation as decisively as John Harrison’s marine chronometer. Prior to the eighteenth century, sailors could compute latitude with relative ease, yet determining longitude remained an intractable puzzle—so much (1) ________ that entire fleets routinely drifted off course onto uncharted reefs.'
      },
      {
        label: 'P2',
        text: 'Word Formation Context (NEC Part B): Modern urban policy demands not merely short-term fiscal fixes, but (2) ________ [VISION] planning that anticipates demographic shifts decades ahead. When municipalities act with reckless (3) ________ [SIGHT], transit corridors saturate almost as soon as they open.'
      },
      {
        label: 'P3',
        text: 'Lexico-Grammar & Inversion (NEC): Only after the archival letters were cross-referenced against port ledgers did historians realize the expedition had been financed clandestinely. Such precision in syntactic control and C2 collocations separates National Prize winners from provincial finalists.'
      }
    ],
    questions: [
      {
        id: 'q1',
        num: 1,
        type: 'completion',
        prompt: '[Open Cloze · ONE WORD] Fill blank (1) in P1: "...remained an intractable puzzle—so much ________ that entire fleets routinely drifted off course..."',
        answer: 'so',
        evidenceParagraph: 'P1',
        explanation: 'The fixed correlative structure "so much so that..." intensifies the preceding clause ("an intractable puzzle").'
      },
      {
        id: 'q2',
        num: 2,
        type: 'completion',
        prompt: '[Word Formation · ONE WORD] Transform [VISION] for blank (2) in P2: "...not merely short-term fiscal fixes, but ________ planning..."',
        answer: 'visionary',
        evidenceParagraph: 'P2',
        explanation: 'The adjective "visionary" (forward-looking, imaginative) modifies "planning" in contrast to "short-term."'
      },
      {
        id: 'q3',
        num: 3,
        type: 'completion',
        prompt: '[Word Formation · ONE WORD] Transform [SIGHT] for blank (3) in P2: "...act with reckless ________, transit corridors saturate..."',
        answer: 'shortsightedness',
        evidenceParagraph: 'P2',
        explanation: 'A negative abstract noun contrasting with forward-looking planning: "shortsightedness."'
      },
      {
        id: 'q4',
        num: 4,
        type: 'mc',
        prompt: '[Lexico-Grammar · C2 Idiom] Choose the best option: After three failed prototypes, the engineering lead refused to throw in the ________ and redesigned the actuator overnight.',
        options: ['A. sponge', 'B. towel', 'C. cloth', 'D. blanket'],
        answer: 'B. towel',
        evidenceParagraph: 'P3',
        explanation: '"Throw in the towel" is the standard C1–C2 idiom meaning to admit defeat or give up.'
      },
      {
        id: 'q5',
        num: 5,
        type: 'mc',
        prompt: '[Sentence Transformation · Inversion] Which rewrite preserves the exact meaning of P3’s opening sentence using negative inversion?',
        options: [
          'A. Not until the archival letters were cross-referenced did historians realize the expedition had been secretly funded.',
          'B. Hardly had the archival letters cross-referenced than historians realized the funding.',
          'C. No sooner were the letters cross-referenced when historians realized the funding.',
          'D. Little historians realized the expedition was clandestinely funded.'
        ],
        answer: 'A. Not until the archival letters were cross-referenced did historians realize the expedition had been secretly funded.',
        evidenceParagraph: 'P3',
        explanation: '"Not until + clause + auxiliary inversion (did historians realize)" accurately mirrors "Only after ... did historians realize."'
      }
    ]
  },
  {
    id: 'hsg25-r1',
    examId: 'hsg',
    sectionKey: 'lexico',
    source: 'HSG Tiếng Anh (Tỉnh / TP) · Lexico-Grammar & Phonology',
    title: 'HSG C1 Drill: Phrasal Verbs, Subjunctive & Word Stress',
    subtitle: 'HSG Lexico & Phonology (4.0 / 20.0 pts) · 4 Provincial Olympiad Items',
    durationSec: 720,
    paragraphs: [
      {
        label: 'L1',
        text: 'Provincial HSG Lexico-Grammar focus: High-scoring HSG papers test precise phrasal verbs, formal mandative subjunctives ("insisted that the report be verified"), and C1 collocations rather than casual approximations.'
      },
      {
        label: 'L2',
        text: 'Word Form & Phonology context: The committee commended her (1) ________ [PERSIST] dedication to rural literacy, noting that few volunteers had demonstrated such (2) ________ [STINT] generosity across three consecutive winters.'
      }
    ],
    questions: [
      {
        id: 'hsgq1',
        num: 1,
        type: 'mc',
        prompt: '[HSG · Mandative Subjunctive] The provincial board insisted that every lab instrument ________ recalibrated before the finals.',
        options: ['A. is', 'B. be', 'C. was', 'D. has been'],
        answer: 'B. be',
        evidenceParagraph: 'L1',
        explanation: 'After "insisted that," the formal mandative subjunctive uses the bare infinitive "be."'
      },
      {
        id: 'hsgq2',
        num: 2,
        type: 'mc',
        prompt: '[HSG · Phrasal Verb] Because the guest speaker fell ill, the moderators had to ________ the closing debate until Friday.',
        options: ['A. put off', 'B. call on', 'C. carry out', 'D. turn in'],
        answer: 'A. put off',
        evidenceParagraph: 'L1',
        explanation: '"Put off" means to postpone to a later time.'
      },
      {
        id: 'hsgq3',
        num: 3,
        type: 'completion',
        prompt: '[HSG Word Form · ONE WORD] Transform [PERSIST] for blank (1) in L2: "...commended her ________ dedication..."',
        answer: 'persistent',
        evidenceParagraph: 'L2',
        explanation: 'Adjective modifying "dedication": "persistent."'
      },
      {
        id: 'hsgq4',
        num: 4,
        type: 'completion',
        prompt: '[HSG Word Form · ONE WORD] Transform [STINT] for blank (2) in L2: "...such ________ generosity..." (meaning generous without limit)',
        answer: 'unstinting',
        evidenceParagraph: 'L2',
        explanation: '"Unstinting generosity" is a classic C1–C2 HSG collocation.'
      }
    ]
  },
  {
    id: 'hsg25-rc1',
    examId: 'hsg',
    sectionKey: 'reading',
    source: 'HSG Tiếng Anh (Tỉnh / TP) · Reading & Guided Cloze',
    title: 'Mangrove Carbon Sinks & Coastal Resilience',
    subtitle: 'HSG Reading & Cloze (5.0 / 20.0 pts) · 4 Comprehension & Cloze Questions',
    durationSec: 900,
    paragraphs: [
      {
        label: 'A',
        text: 'Coastal mangrove forests occupy less than one percent of tropical forest area globally, yet their waterlogged peat soils sequester up to four times as much carbon per hectare as inland rainforests. Because anaerobic mud slows microbial decay, fallen roots remain locked underground for centuries unless dredged or drained for aquaculture.'
      },
      {
        label: 'B',
        text: 'Across the Mekong Delta, community-led restoration replaces concrete seawalls with multi-row mangrove belts. Hydrological surveys show that a 100-meter fringe of mature Rhizophora trees dampens storm-surge wave energy by nearly two-thirds, (1) ________ safeguarding adjacent rice paddies from saltwater intrusion.'
      }
    ],
    questions: [
      {
        id: 'hsgr1',
        num: 1,
        type: 'mc',
        prompt: 'Why do mangrove soils retain carbon for centuries according to Paragraph A?',
        options: [
          'A. Tropical sunlight vaporizes surface peat rapidly.',
          'B. Oxygen-poor (anaerobic) mud slows down microbial decomposition.',
          'C. Inland rainforests transfer carbon into coastal rivers.',
          'D. Concrete seawalls trap fallen mangrove leaves.'
        ],
        answer: 'B. Oxygen-poor (anaerobic) mud slows down microbial decomposition.',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A states anaerobic mud slows microbial decay so roots stay locked underground.'
      },
      {
        id: 'hsgr2',
        num: 2,
        type: 'tfng',
        prompt: 'Mangrove forests cover more than ten percent of the world’s tropical forest area.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A specifies mangroves occupy "less than one percent" of tropical forest area.'
      },
      {
        id: 'hsgr3',
        num: 3,
        type: 'completion',
        prompt: '[HSG Guided Cloze · ONE WORD] Fill blank (1) in Paragraph B: "...by nearly two-thirds, ________ safeguarding adjacent rice paddies..."',
        answer: 'thereby',
        evidenceParagraph: 'B',
        explanation: '"Thereby + -ing" introduces the direct result of dampening wave energy.'
      },
      {
        id: 'hsgr4',
        num: 4,
        type: 'completion',
        prompt: '[HSG Reading · ONE WORD] What threat to nearby rice paddies do mangrove belts help prevent?',
        answer: 'saltwater',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B notes mangroves safeguard adjacent rice paddies from "saltwater intrusion."'
      }
    ]
  },
  {
    id: 'oly25-mcq1',
    examId: 'olympic304',
    sectionKey: 'mcq',
    source: 'Olympic 30/4 Tiếng Anh HCM · Part I MCQ Lexico-Grammar',
    title: 'Olympic 30/4 C2 Idioms, Prepositions & Collocations',
    subtitle: 'Olympic 30/4 MCQ Section (20 / 100 pts) · 4 High-Precision C2 Items',
    durationSec: 600,
    paragraphs: [
      {
        label: 'O1',
        text: 'Olympic 30/4 Part I tests rapid C2 mastery of fixed idiomatic expressions, prepositional verbs, and subtle lexical distinctions under strict 180-minute written exam conditions.'
      }
    ],
    questions: [
      {
        id: 'olyq1',
        num: 1,
        type: 'mc',
        prompt: 'The newly appointed dean wasted no time in getting ________ to brass tacks during the budget hearing.',
        options: ['A. up', 'B. down', 'C. over', 'D. through'],
        answer: 'B. down',
        evidenceParagraph: 'O1',
        explanation: '"Get down to brass tacks" means to focus on the most essential practical facts.'
      },
      {
        id: 'olyq2',
        num: 2,
        type: 'mc',
        prompt: 'Her archival discovery cast serious ________ on the longstanding chronology of the dynasty.',
        options: ['A. doubt', 'B. hesitation', 'C. query', 'D. mistrust'],
        answer: 'A. doubt',
        evidenceParagraph: 'O1',
        explanation: 'Standard C2 collocation: "cast doubt on something."'
      },
      {
        id: 'olyq3',
        num: 3,
        type: 'mc',
        prompt: 'No matter how vehemently the defence objected, the judge remained ________ to emotional appeals.',
        options: ['A. impervious', 'B. impenetrable', 'C. intangible', 'D. implausible'],
        answer: 'A. impervious',
        evidenceParagraph: 'O1',
        explanation: '"Impervious to" means unable to be affected or swayed by.'
      },
      {
        id: 'olyq4',
        num: 4,
        type: 'mc',
        prompt: 'Only by the skin of his ________ did the cyclist avoid colliding with the barrier on the wet descent.',
        options: ['A. fingers', 'B. knuckles', 'C. teeth', 'D. heels'],
        answer: 'C. teeth',
        evidenceParagraph: 'O1',
        explanation: '"By the skin of one’s teeth" means by the narrowest possible margin.'
      }
    ]
  },
  {
    id: 'oly25-cloze1',
    examId: 'olympic304',
    sectionKey: 'cloze',
    source: 'Olympic 30/4 Tiếng Anh HCM · Part II Open Cloze & Word Form',
    title: 'Olympic 30/4 Cloze & Word Formation: Acoustic Architecture',
    subtitle: 'Olympic 30/4 Open Cloze & Word Form (30 / 100 pts) · 4 Precision Items',
    durationSec: 720,
    paragraphs: [
      {
        label: 'C1',
        text: 'Open Cloze: Concert hall acousticians rarely leave reverberation (1) ________ chance. Even a slight shift in timber density can alter how cello overtones carry to the upper balcony, (2) ________ alone the subtle balance between strings and brass.'
      },
      {
        label: 'C2',
        text: 'Word Formation: Despite (3) ________ [PRECEDE] investment in digital modelling, musicians insist that an auditorium’s warmth remains partially (4) ________ [DEFINE] until a live orchestra plays inside.'
      }
    ],
    questions: [
      {
        id: 'olyc1',
        num: 1,
        type: 'completion',
        prompt: '[Open Cloze · ONE WORD] Fill blank (1) in C1: "...rarely leave reverberation ________ chance."',
        answer: 'to',
        evidenceParagraph: 'C1',
        explanation: 'Fixed expression: "leave something to chance."'
      },
      {
        id: 'olyc2',
        num: 2,
        type: 'completion',
        prompt: '[Open Cloze · ONE WORD] Fill blank (2) in C1: "...________ alone the subtle balance between strings and brass."',
        answer: 'let',
        evidenceParagraph: 'C1',
        explanation: 'Fixed negative-emphasis phrase: "let alone."'
      },
      {
        id: 'olyc3',
        num: 3,
        type: 'completion',
        prompt: '[Word Form · ONE WORD] Transform [PRECEDE] for blank (3) in C2: "Despite ________ investment..."',
        answer: 'unprecedented',
        evidenceParagraph: 'C2',
        explanation: '"Unprecedented" means never done or known before.'
      },
      {
        id: 'olyc4',
        num: 4,
        type: 'completion',
        prompt: '[Word Form · ONE WORD] Transform [DEFINE] for blank (4) in C2: "...remains partially ________ until a live orchestra plays..."',
        answer: 'indefinable',
        evidenceParagraph: 'C2',
        explanation: '"Indefinable" means impossible to define or describe precisely.'
      }
    ]
  },
  {
    id: 'oly25-r1',
    examId: 'olympic304',
    sectionKey: 'reading',
    source: 'Olympic 30/4 Tiếng Anh HCM · Part III Reading Comprehension',
    title: 'Paleography & Multispectral Palimpsest Recovery',
    subtitle: 'Olympic 30/4 Reading Section (30 / 100 pts) · 4 C2 Comprehension Items',
    durationSec: 900,
    paragraphs: [
      {
        label: 'A',
        text: 'During the Middle Ages, parchment was so costly that scribes routinely scraped older manuscripts clean and reused the animal skin—creating layered documents known as palimpsests. To the naked eye, only the newer overwriting survives; yet trace iron-gall residues from the erased text remain embedded in the collagen fibers.'
      },
      {
        label: 'B',
        text: 'Modern paleographers illuminate palimpsests with narrow-band ultraviolet and infrared LEDs, capturing dozens of spectral frames that software recombines to separate the underwriting from later ink. Using this non-invasive method, scholars recovered previously lost treatises by Archimedes without lifting a single flake of fragile parchment.'
      }
    ],
    questions: [
      {
        id: 'olyr1',
        num: 1,
        type: 'mc',
        prompt: 'Why did medieval scribes scrape and reuse parchment?',
        options: [
          'A. To conceal mathematical formulas from rivals',
          'B. Because fresh parchment was prohibitively expensive',
          'C. Because iron-gall ink faded after a few decades',
          'D. To strengthen the collagen fibers of animal skin'
        ],
        answer: 'B. Because fresh parchment was prohibitively expensive',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A states parchment "was so costly that scribes routinely scraped older manuscripts clean and reused the animal skin."'
      },
      {
        id: 'olyr2',
        num: 2,
        type: 'completion',
        prompt: '[ONE WORD] Layered reused manuscripts are known as ________.',
        answer: 'palimpsests',
        evidenceParagraph: 'A',
        explanation: 'Paragraph A defines them as "palimpsests."'
      },
      {
        id: 'olyr3',
        num: 3,
        type: 'tfng',
        prompt: 'Multispectral imaging requires physically scraping off the newer ink layer to read the underwriting.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B explicitly calls it a "non-invasive method" that works "without lifting a single flake of fragile parchment."'
      },
      {
        id: 'olyr4',
        num: 4,
        type: 'completion',
        prompt: '[ONE WORD] Name the ancient thinker whose lost treatises were recovered via this imaging method:',
        answer: 'Archimedes',
        evidenceParagraph: 'B',
        explanation: 'Paragraph B highlights recovered treatises by "Archimedes."'
      }
    ]
  }
];

export const LISTENING_TESTS: ListeningTest[] = [
  {
    id: 'mock-l1',
    examId: 'ielts',
    sectionKey: 'listening',
    isMock: true,
    source: '[MOCK EXAM 01] IELTS Listening Parts 2 & 3',
    partLabel: 'Mock Dialogue · Distractors & Self-Corrections',
    title: 'Science Museum Renovation & Audio Guide Briefing',
    instructions: 'Test the full Listening player, single-play exam lock, speed toggle, and post-submit highlighted transcript. Answer with ONE WORD AND/OR A NUMBER.',
    durationSec: 420,
    cues: [
      {
        speaker: 'Curator',
        voiceRole: 'host',
        text: 'Welcome everyone to the volunteer briefing for our renovated Science Pavilion. Before we hand out badges, let us confirm the updated gallery schedule.'
      },
      {
        speaker: 'Volunteer',
        voiceRole: 'guest',
        text: 'Thanks! Does the main Astronomy Hall reopen this Tuesday as printed on the old brochure?'
      },
      {
        speaker: 'Curator',
        voiceRole: 'host',
        text: 'Good catch—Tuesday was our original target, but the planetarium dome calibration runs one extra day, so the doors open to the public on Wednesday.',
        highlightPhrase: 'Wednesday'
      },
      {
        speaker: 'Volunteer',
        voiceRole: 'guest',
        text: 'Got it, Wednesday. And where should school groups store their backpacks while touring the robotics wing?'
      },
      {
        speaker: 'Curator',
        voiceRole: 'host',
        text: 'We moved the free lockers out of the East Atrium. All student bags now go into the Basement cloakroom right beside the ticket desk.',
        highlightPhrase: 'Basement'
      },
      {
        speaker: 'Volunteer',
        voiceRole: 'guest',
        text: 'How many portable audio headsets are assigned to each tour leader?'
      },
      {
        speaker: 'Curator',
        voiceRole: 'host',
        text: 'Each charging tray holds twenty-four headsets, though we reserve four as spares, leaving twenty active units per group.',
        highlightPhrase: '20'
      },
      {
        speaker: 'Volunteer',
        voiceRole: 'guest',
        text: 'And what is the surname of the lead acoustics engineer if a headset channel drops out?'
      },
      {
        speaker: 'Curator',
        voiceRole: 'host',
        text: 'Ask for Priya Kelkar—that is spelled K E L K A R. She is stationed in Control Booth Two.',
        highlightPhrase: 'Kelkar'
      },
      {
        speaker: 'Curator',
        voiceRole: 'host',
        text: 'One final reminder: flash photography is banned inside the Fossil Archive purely because ultraviolet pulses accelerate pigment fading on delicate mineral labels.',
        highlightPhrase: 'pigment fading'
      }
    ],
    questions: [
      {
        id: 'mlq1',
        num: 1,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Confirmed public reopening day of the Astronomy Hall:',
        answers: ['wednesday'],
        explanation: 'Distractor test: Tuesday was the original brochure date, corrected to Wednesday due to dome calibration.'
      },
      {
        id: 'mlq2',
        num: 2,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'New location of school group bag storage (________ cloakroom):',
        answers: ['basement'],
        explanation: 'Lockers moved out of the East Atrium into the Basement cloakroom.'
      },
      {
        id: 'mlq3',
        num: 3,
        type: 'completion',
        wordLimit: 'A NUMBER',
        prompt: 'Active audio headsets allocated per tour group:',
        answers: ['20', 'twenty'],
        explanation: 'Each tray holds 24, minus 4 spares = 20 active units per group.'
      },
      {
        id: 'mlq4',
        num: 4,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Surname of the lead acoustics engineer (Priya ________):',
        answers: ['kelkar'],
        explanation: 'Spelled explicitly in the recording: K-E-L-K-A-R.'
      },
      {
        id: 'mlq5',
        num: 5,
        type: 'mc',
        prompt: 'Why is flash photography prohibited inside the Fossil Archive?',
        options: [
          'A. It interferes with the wireless audio headsets.',
          'B. Ultraviolet light speeds up pigment fading on delicate labels.',
          'C. It distracts school tour groups in the East Atrium.'
        ],
        answers: ['b. ultraviolet light speeds up pigment fading on delicate labels.'],
        explanation: 'The curator explains ultraviolet pulses accelerate pigment fading on delicate mineral labels.'
      }
    ]
  },
  {
    id: 'nec25-l1',
    examId: 'nec',
    sectionKey: 'listening',
    isMock: true,
    source: 'NEC (HSGQG) · Part A Academic Lecture',
    partLabel: 'NEC Part A · Continuous Monologue (5.0 / 20.0 pts)',
    title: 'Urban Sponge Parks & Stormwater Telemetry',
    instructions: 'Listen continuously and complete the NEC lecture notes using ONE WORD ONLY.',
    durationSec: 360,
    cues: [
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'In rapidly expanding coastal megacities, impermeable concrete drains overwhelm easily during monsoon cloudbursts.'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'Landscape hydrologists address this by designing sponge parks: sunken wetland basins lined with porous gravel that absorb runoff before it reaches sewer pipes.',
        highlightPhrase: 'gravel'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'Deep-rooted native reeds then filter heavy metals and petroleum residue naturally over forty-eight hours.',
        highlightPhrase: 'reeds'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'Modern sites embed low-power acoustic sensors inside retention cisterns to transmit water-level telemetry every five minutes.',
        highlightPhrase: 'cisterns'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'During dry summer spells, municipalities pump that purified stormwater back out to irrigate street trees, cutting potable water consumption by forty percent.',
        highlightPhrase: 'forty'
      }
    ],
    questions: [
      {
        id: 'ml2q1',
        num: 1,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Sunken wetland basins are lined with porous ________ to soak up storm runoff.',
        answers: ['gravel'],
        explanation: 'Lecturer specifies basins are "lined with porous gravel."'
      },
      {
        id: 'ml2q2',
        num: 2,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Heavy metals and petroleum residue are filtered by deep-rooted native ________.',
        answers: ['reeds', 'reed'],
        explanation: 'Lecturer notes "Deep-rooted native reeds then filter heavy metals."'
      },
      {
        id: 'ml2q3',
        num: 3,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Low-power telemetry sensors are installed inside retention ________.',
        answers: ['cisterns', 'cistern'],
        explanation: 'Sensors are embedded "inside retention cisterns."'
      },
      {
        id: 'ml2q4',
        num: 4,
        type: 'completion',
        wordLimit: 'ONE WORD OR NUMBER',
        prompt: 'Reusing stored stormwater for tree irrigation reduces potable water use by ________ percent.',
        answers: ['40', 'forty'],
        explanation: 'Lecturer concludes it cuts potable water consumption by 40%.'
      }
    ]
  },
  {
    id: 'cam20-l1',
    examId: 'ielts',
    sectionKey: 'listening',
    source: 'Cambridge IELTS 20 · Listening Part 1',
    partLabel: 'Part 1 · Everyday Social Dialogue',
    title: 'Harbourside Bike Library Membership',
    instructions: 'Listen once under exam constraints. Complete the form using ONE WORD AND/OR A NUMBER, then answer the multiple-choice questions.',
    durationSec: 480,
    cues: [
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Good morning, Harbourside Community Bike Library. How can I help you today?'
      },
      {
        speaker: 'Caller',
        voiceRole: 'guest',
        text: 'Hi! I would like to register for a seasonal commuter pass before next Monday.'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Certainly. Could I take your surname first, please?'
      },
      {
        speaker: 'Caller',
        voiceRole: 'guest',
        text: 'Sure, it is Halvorsen—that is spelled H A L V O R S E N.',
        highlightPhrase: 'Halvorsen'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Thank you. And which pickup dock is closest to your workplace? We have North Pier, Westbridge, and Central Market.'
      },
      {
        speaker: 'Caller',
        voiceRole: 'guest',
        text: 'I thought North Pier at first, actually Westbridge is right beside my studio, so let us put Westbridge.',
        highlightPhrase: 'Westbridge'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Got it, Westbridge dock. Now, for the three-month commuter pass, the refundable deposit is forty-five pounds—wait, sorry, that was last winter; this season it is thirty-five pounds.',
        highlightPhrase: '35'
      },
      {
        speaker: 'Caller',
        voiceRole: 'guest',
        text: 'Thirty-five pounds sounds very reasonable. Does that include a safety helmet and lock?'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'A heavy-duty steel lock is always included free of charge. Helmets can be borrowed for an extra fee, and lights are built straight into the frame.',
        highlightPhrase: 'lock'
      },
      {
        speaker: 'Caller',
        voiceRole: 'guest',
        text: 'Great, I already own a helmet. When are the free brake-check workshops held?'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Our mechanic runs drop-in maintenance every Thursday evening at six-thirty, right after the commuter rush.',
        highlightPhrase: 'Thursday'
      },
      {
        speaker: 'Caller',
        voiceRole: 'guest',
        text: 'Thursday evenings work nicely. One last question—why do you recommend booking e-bikes in advance?'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Because our charging rack only holds twelve batteries at once, so unreserved e-bikes usually run out before nine a.m.',
        highlightPhrase: 'twelve batteries'
      }
    ],
    questions: [
      {
        id: 'lq1',
        num: 1,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Applicant surname:',
        answers: ['halvorsen'],
        explanation: 'The caller spells their surname explicitly: H-A-L-V-O-R-S-E-N.'
      },
      {
        id: 'lq2',
        num: 2,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Preferred pickup dock:',
        answers: ['westbridge'],
        explanation: 'Classic IELTS distractor: caller first mentions North Pier, then self-corrects to Westbridge.'
      },
      {
        id: 'lq3',
        num: 3,
        type: 'completion',
        wordLimit: 'A NUMBER',
        prompt: 'Current refundable deposit (£):',
        answers: ['35', '£35', 'thirty-five', 'thirty five'],
        explanation: 'Coordinator corrects last winter’s £45 fee to the current £35 deposit.'
      },
      {
        id: 'lq4',
        num: 4,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Accessory included free with membership (steel):',
        answers: ['lock'],
        explanation: 'Coordinator confirms a heavy-duty steel lock is always included free of charge.'
      },
      {
        id: 'lq5',
        num: 5,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Day of weekly free brake-check workshop:',
        answers: ['thursday', 'thursdays'],
        explanation: 'Drop-in maintenance runs every Thursday evening at 6:30.'
      },
      {
        id: 'lq6',
        num: 6,
        type: 'mc',
        prompt: 'Why should commuters reserve electric bikes in advance?',
        options: [
          'A. They require a separate safety licence.',
          'B. The charging rack can only supply twelve batteries at a time.',
          'C. They are closed on Thursday evenings.'
        ],
        answers: ['b. the charging rack can only supply twelve batteries at a time.'],
        explanation: 'The coordinator explains the charging rack only holds twelve batteries at once, so unreserved e-bikes run out before 9 a.m.'
      }
    ]
  },
  {
    id: 'cam19-l4',
    examId: 'ielts',
    sectionKey: 'listening',
    source: 'Cambridge IELTS 19 · Listening Part 4',
    partLabel: 'Part 4 · Academic University Lecture',
    title: 'Acoustic Restoration of Coral Reefs',
    instructions: 'Complete the lecture notes using ONE WORD ONLY while listening continuously without pause.',
    durationSec: 420,
    cues: [
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'Today we examine how underwater acoustics helps marine biologists rehabilitate degraded coral reefs.'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'Healthy reefs are surprisingly loud. Snapping shrimp and grazing fish create a continuous chorus that drifting juvenile fish detect from several kilometres away.',
        highlightPhrase: 'shrimp'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'When warming events bleach coral structures, the reef turns eerily silent. Without acoustic cues, young fish swim right past damaged patches instead of settling.',
        highlightPhrase: 'silent'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'In a six-week field experiment on the Great Barrier Reef, researchers installed waterproof underwater loudspeakers on dead coral rubble and broadcast healthy reef recordings.',
        highlightPhrase: 'loudspeakers'
      },
      {
        speaker: 'Lecturer',
        voiceRole: 'lecturer',
        text: 'Compared with silent control patches, acoustically enriched sites attracted twice as many damselfish, which play a crucial role in clearing suffocating algae from coral surfaces.',
        highlightPhrase: 'algae'
      }
    ],
    questions: [
      {
        id: 'lq1',
        num: 1,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Healthy reef soundscapes are generated by grazing fish and snapping ________.',
        answers: ['shrimp', 'shrimps'],
        explanation: 'Lecturer notes "snapping shrimp and grazing fish create a continuous chorus."'
      },
      {
        id: 'lq2',
        num: 2,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Bleached coral reefs lose settlers because the habitat becomes ________.',
        answers: ['silent'],
        explanation: 'Lecturer states "the reef turns eerily silent" after bleaching.'
      },
      {
        id: 'lq3',
        num: 3,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Researchers replayed healthy reef audio using waterproof underwater ________.',
        answers: ['loudspeakers', 'speakers'],
        explanation: 'Researchers installed "waterproof underwater loudspeakers" on coral rubble.'
      },
      {
        id: 'lq4',
        num: 4,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Returning damselfish aid reef recovery by removing suffocating ________.',
        answers: ['algae'],
        explanation: 'Damselfish clear "suffocating algae from coral surfaces."'
      }
    ]
  },
  {
    id: 'hsg25-l1',
    examId: 'hsg',
    sectionKey: 'listening',
    source: 'HSG Tiếng Anh (Tỉnh / TP) · Listening Comprehension',
    partLabel: 'HSG Listening · Provincial Audio Briefing (4.0 / 20.0 pts)',
    title: 'Heritage Tramway Restoration & Acoustic Signalling',
    instructions: 'Listen carefully under HSG exam conditions and complete the notes with ONE WORD OR A NUMBER.',
    durationSec: 360,
    cues: [
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Welcome to the provincial heritage transport seminar. Today we outline the restoration of Line Four, our historic lakeside tramway.'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Engineers originally planned to install steel sleepers, but switched to recycled teak timber to preserve authentic track resonance.',
        highlightPhrase: 'teak'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Each carriage runs on rooftop lithium capacitors that recharge in just ninety seconds at every terminal platform.',
        highlightPhrase: '90'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Rather than loud air horns, drivers alert cyclists using brass bells tuned to a gentle harmonic pitch.',
        highlightPhrase: 'bells'
      },
      {
        speaker: 'Coordinator',
        voiceRole: 'host',
        text: 'Student volunteers guiding weekend tours must register at the Old Depot office before Thursday afternoon.',
        highlightPhrase: 'Thursday'
      }
    ],
    questions: [
      {
        id: 'hsgl1',
        num: 1,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Track sleepers are built from recycled ________ timber instead of steel.',
        answers: ['teak'],
        explanation: 'Coordinator states they switched from steel to recycled teak timber.'
      },
      {
        id: 'hsgl2',
        num: 2,
        type: 'completion',
        wordLimit: 'A NUMBER',
        prompt: 'Rooftop lithium capacitors recharge at terminal platforms in ________ seconds.',
        answers: ['90', 'ninety'],
        explanation: 'Carriages recharge in ninety seconds at every terminal platform.'
      },
      {
        id: 'hsgl3',
        num: 3,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Drivers warn nearby cyclists using brass ________ rather than loud air horns.',
        answers: ['bells', 'bell'],
        explanation: 'Drivers alert cyclists using brass bells.'
      },
      {
        id: 'hsgl4',
        num: 4,
        type: 'completion',
        wordLimit: 'ONE WORD',
        prompt: 'Deadline day for weekend student volunteer registration at the Old Depot:',
        answers: ['thursday'],
        explanation: 'Volunteers must register before Thursday afternoon.'
      }
    ]
  }
];

export const WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: 'mock-w1',
    examId: 'ielts',
    sectionKey: 'writing',
    isMock: true,
    task: 'task1',
    source: '[MOCK EXAM 01] IELTS Academic Writing Task 1',
    title: 'Grid Battery Storage Capacity by Region (2020–2026)',
    durationSec: 1200,
    minWords: 150,
    prompt: 'The chart and table below show the percentage share of utility-scale renewable electricity paired with grid battery storage across four regions between 2020 and 2026. Summarise the main trends and make relevant comparisons. Write at least 150 words.',
    tableData: {
      caption: 'Share of utility renewables backed by battery storage (%)',
      headers: ['Region', '2020', '2023', '2026', '6-Yr Shift'],
      rows: [
        ['East Asia', 24, 46, 74, '+50%'],
        ['Western Europe', 18, 39, 65, '+47%'],
        ['North America', 21, 44, 71, '+50%'],
        ['Southeast Asia', 9, 22, 48, '+39%']
      ]
    }
  },
  {
    id: 'mock-w2',
    examId: 'ielts',
    sectionKey: 'writing',
    isMock: true,
    task: 'task2',
    source: '[MOCK EXAM 02] IELTS Academic Writing Task 2',
    title: 'Self-Study Tools vs. Traditional Peer Classrooms',
    durationSec: 2400,
    minWords: 250,
    prompt: 'With interactive voice tutors and adaptive online mock exams becoming widely available, some educators believe independent digital study will soon outperform traditional classroom test preparation. To what extent do you agree or disagree? Support your argument with clear reasoning and examples. Write at least 250 words.'
  },
  {
    id: 'cam20-w1',
    examId: 'ielts',
    sectionKey: 'writing',
    task: 'task1',
    source: 'Cambridge IELTS 20 · Academic Writing Task 1',
    title: 'Municipal Renewable Electricity Share (2015–2025)',
    durationSec: 1200,
    minWords: 150,
    prompt: 'The table and bar chart below show the percentage of municipal electricity generated from renewable sources in four European cities between 2015 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
    tableData: {
      caption: 'Share of municipal electricity from renewables (%)',
      headers: ['City', '2015', '2020', '2025', '10-Yr Change'],
      rows: [
        ['Copenhagen', 48, 67, 84, '+36%'],
        ['Rotterdam', 22, 41, 63, '+41%'],
        ['Vienna', 35, 49, 68, '+33%'],
        ['Milan', 19, 31, 52, '+33%']
      ]
    }
  },
  {
    id: 'cam20-w2',
    examId: 'ielts',
    sectionKey: 'writing',
    task: 'task2',
    source: 'Cambridge IELTS 20 · Writing Task 2 Essay (2/3 Weight)',
    title: 'Remote Work & Investment in Public Transit',
    durationSec: 2400,
    minWords: 250,
    prompt: 'As remote and hybrid work become more common, some argue that cities should spend less on expanding commuter rail networks and invest more in neighbourhood parks and local libraries instead. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.'
  },
  {
    id: 'nec25-w1',
    examId: 'nec',
    sectionKey: 'writing',
    task: 'task2',
    source: 'NEC (HSGQG Tiếng Anh) · Part D Academic Essay (6.0 / 20.0 pts)',
    title: 'Algorithmic Curation & Intellectual Serendipity',
    durationSec: 3000,
    minWords: 350,
    prompt: 'Some scholars contend that hyper-personalized recommendation algorithms accelerate deep specialization, while others warn they erode intellectual serendipity and civic empathy by sealing learners inside ideological echo chambers. Discuss both views and present a nuanced thesis supported by concrete evidence. Write at least 350 words (NEC Part D standard).'
  },
  {
    id: 'hsg25-w1',
    examId: 'hsg',
    sectionKey: 'writing',
    task: 'task2',
    source: 'HSG Tiếng Anh (Tỉnh / TP) · Part IV Academic Essay (5.0 / 20.0 pts)',
    title: 'Preserving Local Dialects in an Interconnected World',
    durationSec: 2400,
    minWords: 250,
    prompt: 'As global lingua francas dominate higher education and digital commerce, regional dialects and minority languages face rapid attrition among younger generations. Should secondary schools allocate formal curriculum hours to local linguistic heritage? Write a well-structured essay of at least 250 words with specific examples.'
  },
  {
    id: 'oly25-w1',
    examId: 'olympic304',
    sectionKey: 'transform',
    task: 'task1',
    source: 'Olympic 30/4 Tiếng Anh HCM · Part IV Sentence Transformation (20 / 100 pts)',
    title: 'C2 Key-Word Rewrites, Inversion & Synthesis Drill',
    durationSec: 1200,
    minWords: 120,
    prompt: 'Rewrite the following five C2 sentences cleanly in full (incorporating each given prompt/keyword without altering meaning), then write a concise 80-word analytical note explaining the grammatical structures used:\n1. She only realized the archive had been mislabelled after the lecture ended. → Not until...\n2. Critics strongly disapproved of the developer’s plan to demolish the observatory. → [DIM] Critics took a...\n3. He didn’t hesitate for a moment before volunteering to translate the treaty. → [BONES] He made...\n4. Although the experiment looked trivial, it reshaped battery chemistry. → Trivial...\n5. We should have audited the sensors much earlier. → It is high time...'
  }
];

export const SPEAKING_TESTS: SpeakingTest[] = [
  {
    id: 'mock-s1',
    examId: 'ielts',
    sectionKey: 'speaking',
    isMock: true,
    examMode: 'ielts',
    source: '[MOCK EXAM 01] IELTS Speaking Full Mock (Parts 1–3)',
    title: 'Quiet Spaces, Digital Focus & Lifelong Learning',
    turns: [
      {
        part: 1,
        label: 'Part 1 · Warm-Up (Q1)',
        prompt: 'Hello, welcome to your mock IELTS Speaking test. Let us start with Part 1: do you usually study in a quiet environment, or do you prefer background sounds like music or a café?',
        speakSec: 45
      },
      {
        part: 1,
        label: 'Part 1 · Daily Routines (Q2)',
        prompt: 'What is one digital app or tool you use every week to stay organized, and how would your routine change without it?',
        speakSec: 45
      },
      {
        part: 2,
        label: 'Part 2 · Cue Card Long Turn (1–2 min)',
        prompt: 'Now I am giving you a Part 2 cue card. You have one minute to jot notes, and then please speak for one to two minutes uninterrupted.',
        cueCardBullets: [
          'Describe a challenging academic topic or exam skill you recently improved.',
          'What the topic or skill was',
          'Why you found it difficult at first',
          'What methods or feedback helped you overcome the challenge',
          'And explain how you felt once you noticed clear progress.'
        ],
        prepSec: 60,
        speakSec: 120
      },
      {
        part: 3,
        label: 'Part 3 · Discussion (Q1)',
        prompt: 'Moving into Part 3: why do you think standardized exams remain so influential for university admissions despite growing criticism?',
        speakSec: 60
      },
      {
        part: 3,
        label: 'Part 3 · Discussion (Q2)',
        prompt: 'How should schools balance teaching independent critical thinking with training students for timed competitive tests?',
        speakSec: 60
      }
    ]
  },
  {
    id: 'mock-s2',
    examId: 'nec',
    sectionKey: 'speaking',
    isMock: true,
    examMode: 'nec',
    source: 'NEC (HSGQG) · Day 2 Monologue Speaking (2.0 / 20.0 pts)',
    title: 'Meritocracy, Authorship & Civic Debate (C1–C2)',
    turns: [
      {
        part: 1,
        label: 'NEC Opening · Position Framing',
        prompt: 'Welcome to your NEC Day 2 Speaking mock. To begin: should national competitions prioritize spontaneous analytical speaking over memorized rhetorical templates? Give a clear stance.',
        speakSec: 60
      },
      {
        part: 2,
        label: 'NEC 5-Min Monologue Prompt (Compressed 2m Mock)',
        prompt: 'You have one minute to structure a balanced C2 argument on the following prompt, then deliver a cohesive monologue with counter-argument and rebuttal.',
        cueCardBullets: [
          'Topic: "When automated tools can draft essays effortlessly, authentic spoken defense becomes the truest test of human understanding."',
          'Define what constitutes genuine intellectual ownership',
          'Weigh potential equity drawbacks for introverted or non-native speakers',
          'Propose a practical assessment model for future national exams'
        ],
        prepSec: 60,
        speakSec: 120
      },
      {
        part: 3,
        label: 'NEC Cross-Examination (Q1)',
        prompt: 'Critics argue oral examinations introduce unconscious examiner bias compared with anonymous written papers. How would you rebut or qualify that objection?',
        speakSec: 60
      },
      {
        part: 3,
        label: 'NEC Cross-Examination (Q2)',
        prompt: 'Looking ten years ahead, which communicative skill will distinguish top-tier scholars most sharply from automated systems?',
        speakSec: 60
      }
    ]
  },
  {
    id: 'hsg25-s1',
    examId: 'hsg',
    sectionKey: 'speaking',
    examMode: 'hsg',
    source: 'HSG Tiếng Anh · Gifted Round 2 Speaking (2.0 / 20.0 pts)',
    title: 'Youth Innovation, Urban Green Space & Public Libraries',
    turns: [
      {
        part: 1,
        label: 'HSG Opening · Warm-Up',
        prompt: 'Welcome to the HSG Gifted Round 2 Speaking assessment. First, what public facility in your city or province has influenced your study habits the most?',
        speakSec: 45
      },
      {
        part: 2,
        label: 'HSG Topic Monologue (Prep + 2m Speech)',
        prompt: 'You have one minute to prepare notes on this provincial topic, then present a clear, structured response with concrete examples.',
        cueCardBullets: [
          'Topic: "Cities invest heavily in commercial centres, yet free public libraries and green parks contribute far more to long-term youth potential."',
          'State your thesis clearly',
          'Offer two concrete civic or educational arguments',
          'Acknowledge and address one counter-argument'
        ],
        prepSec: 60,
        speakSec: 120
      },
      {
        part: 3,
        label: 'HSG Panel Follow-Up (Q1)',
        prompt: 'How can local high schools encourage students to read beyond exam syllabuses when academic schedules are already packed?',
        speakSec: 60
      }
    ]
  },
  {
    id: 'cam20-s1',
    examId: 'ielts',
    sectionKey: 'speaking',
    examMode: 'ielts',
    source: 'Cambridge IELTS 20 · Full Speaking Interview (Parts 1–3)',
    title: 'Self-Directed Learning & Study Habits',
    turns: [
      {
        part: 1,
        label: 'Part 1 · Introduction (Q1)',
        prompt: 'Good afternoon. Let us begin with Part 1. Where do you usually prefer to study or work during the week, and why does that space suit you?',
        speakSec: 45
      },
      {
        part: 1,
        label: 'Part 1 · Familiar Topics (Q2)',
        prompt: 'Do you find it easier to concentrate early in the morning or later in the evening? How has that changed over the past few years?',
        speakSec: 45
      },
      {
        part: 2,
        label: 'Part 2 · Individual Long Turn (Cue Card)',
        prompt: 'Now for Part 2. You have one minute to prepare notes on this topic, and then you should speak for one to two minutes uninterrupted.',
        cueCardBullets: [
          'Describe a practical skill you taught yourself outside of school or university.',
          'What the skill was and when you started learning it',
          'What resources or practice routines you used',
          'What obstacles you faced while improving',
          'And explain how this skill has benefited you since.'
        ],
        prepSec: 60,
        speakSec: 120
      },
      {
        part: 3,
        label: 'Part 3 · Abstract Two-Way Discussion (Q1)',
        prompt: 'Let us move on to Part 3. Why do you think self-study platforms have become so popular compared with traditional classroom courses?',
        speakSec: 60
      },
      {
        part: 3,
        label: 'Part 3 · Abstract Two-Way Discussion (Q2)',
        prompt: 'In the future, do you believe human teachers will remain essential for high-stakes skills like writing and speaking, or will automated feedback replace much of that role?',
        speakSec: 60
      }
    ]
  }
];

export const SPEAKING_TEST: SpeakingTest = SPEAKING_TESTS[0];

export function rawRatioToBand(correct: number, total: number): number {
  if (total <= 0) return 0;
  const pct = correct / total;
  if (pct >= 0.96) return 9.0;
  if (pct >= 0.88) return 8.5;
  if (pct >= 0.8) return 8.0;
  if (pct >= 0.72) return 7.5;
  if (pct >= 0.63) return 7.0;
  if (pct >= 0.54) return 6.5;
  if (pct >= 0.45) return 6.0;
  if (pct >= 0.35) return 5.5;
  if (pct >= 0.25) return 5.0;
  return 4.5;
}

export interface WritingRubricResult {
  overall: number;
  qualityRatio: number;
  ta: number;
  cc: number;
  lr: number;
  gra: number;
  words: number;
  paragraphs: number;
  sentences: number;
  notes: string[];
}

export function evaluateWritingRubric(text: string, minWords: number, isTask1: boolean): WritingRubricResult {
  const cleaned = text.trim();
  const wordsArr = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
  const words = wordsArr.length;
  const paragraphs = cleaned ? cleaned.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length : 0;
  const sentences = cleaned ? cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 3).length : 0;

  const lowerWords = wordsArr.map((w) => w.toLowerCase().replace(/[^a-z'-]/g, '')).filter(Boolean);
  const uniqueWords = new Set(lowerWords);
  const ttr = lowerWords.length > 0 ? uniqueWords.size / lowerWords.length : 0;
  const longWords = lowerWords.filter((w) => w.length >= 7).length;
  const longRatio = lowerWords.length > 0 ? longWords / lowerWords.length : 0;

  const cohesiveMarkers = [
    'however', 'moreover', 'furthermore', 'consequently', 'meanwhile', 'whereas',
    'although', 'despite', 'overall', 'in contrast', 'for example', 'therefore', 'nevertheless'
  ];
  const lowerFull = cleaned.toLowerCase();
  const markerHits = cohesiveMarkers.filter((m) => lowerFull.includes(m)).length;

  const complexMarkers = ['which', 'although', 'whereas', 'because', 'while', 'despite', 'whose', 'unless'];
  const complexHits = complexMarkers.filter((m) => new RegExp(`\\b${m}\\b`).test(lowerFull)).length;

  const roundHalf = (n: number) => Math.min(9.0, Math.max(4.0, Math.round(n * 2) / 2));

  // Task Achievement / Response
  let ta = 5.0;
  if (words >= minWords) ta += 1.5;
  else if (words >= minWords * 0.75) ta += 0.5;
  if (isTask1 && /overall|summary|trend|increase|rose|grew|highest|lowest/.test(lowerFull)) ta += 1.0;
  if (!isTask1 && paragraphs >= 4) ta += 1.0;
  if (words >= minWords + 45) ta += 0.5;

  // Coherence & Cohesion
  let cc = 5.0;
  if (paragraphs >= 3) cc += 1.0;
  if (paragraphs >= 4) cc += 0.5;
  cc += Math.min(1.5, markerHits * 0.4);

  // Lexical Resource
  let lr = 5.0;
  if (ttr >= 0.48) lr += 1.0;
  if (ttr >= 0.58) lr += 0.5;
  if (longRatio >= 0.22) lr += 1.0;
  if (longRatio >= 0.30) lr += 0.5;

  // Grammatical Range & Accuracy
  const avgSentLen = sentences > 0 ? words / sentences : 0;
  let gra = 5.0;
  if (avgSentLen >= 13 && avgSentLen <= 26) gra += 1.0;
  gra += Math.min(1.5, complexHits * 0.45);
  if (sentences >= 8) gra += 0.5;

  ta = roundHalf(ta);
  cc = roundHalf(cc);
  lr = roundHalf(lr);
  gra = roundHalf(gra);
  const overall = roundHalf((ta + cc + lr + gra) / 4);

  const notes: string[] = [];
  if (words < minWords) {
    notes.push(`Word count (${words}) is below the official ${minWords}-word floor—expand supporting points to avoid a Task penalty.`);
  } else {
    notes.push(`Clears the ${minWords}-word requirement cleanly (${words} words across ${paragraphs} paragraph${paragraphs === 1 ? '' : 's'}).`);
  }
  if (isTask1 && !/overall|trend|generally/.test(lowerFull)) {
    notes.push('Add an explicit overview paragraph ("Overall, ...") summarizing the main trends without raw numbers to unlock Band 7+ TA.');
  }
  if (paragraphs < 3) {
    notes.push('Split your response into 3–4 clear paragraphs separated by blank lines so each main idea has a clear topic sentence.');
  }
  if (markerHits < 2) {
    notes.push('Strengthen Coherence & Cohesion by integrating precise contrast and consequence linkers (whereas, consequently, however).');
  }
  if (complexHits < 2) {
    notes.push('Mix subordinate clauses (although, which, whereas) with concise simple sentences to elevate Grammatical Range.');
  }

  const qualityRatio = Math.max(0.35, Math.min(0.98, ((ta + cc + lr + gra) / 4) / 9.0));

  return { overall, qualityRatio, ta, cc, lr, gra, words, paragraphs, sentences, notes };
}

export interface SpeakingRubricResult {
  overall: number;
  qualityRatio: number;
  fc: number;
  lr: number;
  gra: number;
  pron: number;
  totalWords: number;
  turnsAnswered: number;
  notes: string[];
}

export function evaluateSpeakingRubric(
  responses: Record<number, string>,
  totalTurns: number
): SpeakingRubricResult {
  const entries = Object.values(responses).map((s) => s.trim()).filter(Boolean);
  const turnsAnswered = entries.length;
  const fullText = entries.join(' ');
  const wordsArr = fullText ? fullText.split(/\s+/).filter(Boolean) : [];
  const totalWords = wordsArr.length;
  const uniqueRatio = totalWords > 0 ? new Set(wordsArr.map((w) => w.toLowerCase().replace(/[^a-z']/g, ''))).size / totalWords : 0;
  const part2Words = (responses[2] || '').trim().split(/\s+/).filter(Boolean).length;

  const roundHalf = (n: number) => Math.min(9.0, Math.max(4.0, Math.round(n * 2) / 2));

  let fc = 5.0 + Math.min(2.0, (turnsAnswered / Math.max(1, totalTurns)) * 1.5);
  if (part2Words >= 120) fc += 1.0;
  else if (part2Words >= 65) fc += 0.5;

  let lr = 5.0 + (uniqueRatio >= 0.45 ? 1.0 : 0.5) + (totalWords >= 220 ? 1.0 : 0.5);
  let gra = 5.5 + (/\b(although|however|whereas|because|which|would have|used to)\b/i.test(fullText) ? 1.5 : 0.5);
  let pron = 5.5 + (turnsAnswered >= 4 ? 1.0 : 0.5) + (totalWords >= 180 ? 0.5 : 0);

  fc = roundHalf(fc);
  lr = roundHalf(lr);
  gra = roundHalf(gra);
  pron = roundHalf(pron);
  const overall = roundHalf((fc + lr + gra + pron) / 4);

  const notes: string[] = [
    `Answered ${turnsAnswered}/${totalTurns} examiner prompts (${totalWords} words captured).`,
    part2Words < 110
      ? `Part 2 long turn captured ${part2Words} words—aim for 150–220 words across the full 2 minutes using your 1-minute prep bullets.`
      : `Solid Part 2 long-turn development (${part2Words} words) covering the cue card cleanly.`,
    'In Part 3, frame each answer with a direct claim, a societal example, and a contrasting viewpoint to push Fluency & Lexical Resource toward Band 8.0.'
  ];

  const qualityRatio = Math.max(0.35, Math.min(0.98, ((fc + lr + gra + pron) / 4) / 9.0));

  return { overall, qualityRatio, fc, lr, gra, pron, totalWords, turnsAnswered, notes };
}

export const SKILL_META: Record<SkillId, { label: string; route: string; color: string; timing: string }> = {
  reading: { label: 'Reading', route: 'app/reading', color: '#D873B3', timing: '60m · Split-Pane' },
  listening: { label: 'Listening', route: 'app/listening', color: '#2BA676', timing: '30m · Audio' },
  writing: { label: 'Writing', route: 'app/writing', color: '#A98BF7', timing: '60m · 2 Tasks' },
  speaking: { label: 'Speaking', route: 'app/speaking', color: '#2370E8', timing: '11–14m · Examiner' },
};
