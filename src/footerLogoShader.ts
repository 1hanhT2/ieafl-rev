import * as THREE from 'three';

const GRID_COLS = 39;
const GRID_ROWS = 9;
const CELL_W = 5;
const CELL_H = 4;
const VB_W = GRID_COLS * CELL_W; // 195
const VB_H = GRID_ROWS * CELL_H; // 36

const LETTER_GLYPHS: ReadonlyArray<{
  char: string;
  colOffset: number;
  rows: readonly string[];
  powerCells: ReadonlyArray<[number, number]>;
  path: ReadonlyArray<[number, number]>;
}> = [
  {
    char: 'I',
    colOffset: 0,
    rows: [
      '.#####.',
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '.#####.',
    ],
    powerCells: [
      [1, 0],
      [5, 0],
      [1, 8],
      [5, 8],
    ],
    // Local (col, row) waypoints tracing every stroke of 'I'
    path: [
      [1, 0],
      [5, 0],
      [3, 0],
      [3, 8],
      [5, 8],
      [1, 8],
      [3, 8],
      [3, 0],
      [1, 0],
    ],
  },
  {
    char: 'E',
    colOffset: 8,
    rows: [
      '#######',
      '#......',
      '#......',
      '#......',
      '######.',
      '#......',
      '#......',
      '#......',
      '#######',
    ],
    powerCells: [
      [6, 0],
      [5, 4],
      [6, 8],
    ],
    path: [
      [6, 0],
      [0, 0],
      [0, 4],
      [5, 4],
      [0, 4],
      [0, 8],
      [6, 8],
      [0, 8],
      [0, 0],
      [6, 0],
    ],
  },
  {
    char: 'A',
    colOffset: 16,
    rows: [
      '..###..',
      '.#...#.',
      '#.....#',
      '#.....#',
      '#.....#',
      '#######',
      '#.....#',
      '#.....#',
      '#.....#',
    ],
    powerCells: [
      [3, 0],
      [0, 8],
      [6, 8],
    ],
    path: [
      [0, 8],
      [0, 2],
      [1, 1],
      [2, 0],
      [4, 0],
      [5, 1],
      [6, 2],
      [6, 5],
      [0, 5],
      [6, 5],
      [6, 8],
      [6, 5],
      [0, 5],
      [0, 8],
    ],
  },
  {
    char: 'F',
    colOffset: 24,
    rows: [
      '#######',
      '#......',
      '#......',
      '#......',
      '######.',
      '#......',
      '#......',
      '#......',
      '#......',
    ],
    powerCells: [
      [6, 0],
      [5, 4],
      [0, 8],
    ],
    path: [
      [0, 8],
      [0, 0],
      [6, 0],
      [0, 0],
      [0, 4],
      [5, 4],
      [0, 4],
      [0, 8],
    ],
  },
  {
    char: 'L',
    colOffset: 32,
    rows: [
      '#......',
      '#......',
      '#......',
      '#......',
      '#......',
      '#......',
      '#......',
      '#......',
      '#######',
    ],
    powerCells: [
      [0, 0],
      [6, 8],
    ],
    path: [
      [0, 0],
      [0, 8],
      [6, 8],
      [0, 8],
      [0, 0],
    ],
  },
];

interface CompiledPath {
  points: Array<{ x: number; y: number }>;
  cumLen: number[];
  totalLen: number;
}

function compileLetterPaths(): CompiledPath[] {
  return LETTER_GLYPHS.map((letter) => {
    const points = letter.path.map(([lc, lr]) => ({
      x: (letter.colOffset + lc + 0.5) * CELL_W,
      y: (lr + 0.5) * CELL_H,
    }));
    const cumLen: number[] = [0];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      total += Math.hypot(dx, dy);
      cumLen.push(total);
    }
    return { points, cumLen, totalLen: total };
  });
}

function samplePath(
  compiled: CompiledPath,
  dist: number
): { x: number; y: number; dx: number; dy: number } {
  const len = compiled.totalLen;
  if (len <= 0 || compiled.points.length < 2) {
    return { x: 0, y: 0, dx: 1, dy: 0 };
  }
  const d = ((dist % len) + len) % len;
  const { points, cumLen } = compiled;
  for (let i = 1; i < cumLen.length; i++) {
    if (d <= cumLen[i] || i === cumLen.length - 1) {
      const segLen = Math.max(0.0001, cumLen[i] - cumLen[i - 1]);
      const t = Math.min(1, Math.max(0, (d - cumLen[i - 1]) / segLen));
      const a = points[i - 1];
      const b = points[i];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const mag = Math.hypot(vx, vy) || 1;
      return {
        x: a.x + vx * t,
        y: a.y + vy * t,
        dx: vx / mag,
        dy: vy / mag,
      };
    }
  }
  return { x: points[0].x, y: points[0].y, dx: 1, dy: 0 };
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform sampler2D uMaskTex;
  uniform sampler2D uPelletTex;
  uniform float uHover[5];
  uniform vec2 uPacPos[5];
  uniform vec2 uPacDir[5];
  uniform vec2 uGhost1Pos[5];
  uniform vec2 uGhost1Dir[5];
  uniform vec2 uGhost2Pos[5];
  uniform vec2 uGhost2Dir[5];

  const float VB_W = 195.0;
  const float VB_H = 36.0;
  const float CELL_W = 5.0;
  const float CELL_H = 4.0;
  const float PI = 3.14159265359;

  float sampleMaskAt(vec2 p) {
    if (p.x < 0.0 || p.x >= VB_W || p.y < 0.0 || p.y >= VB_H) {
      return 0.0;
    }
    vec2 uv = vec2(p.x / VB_W, 1.0 - (p.y / VB_H));
    return texture2D(uMaskTex, uv).r;
  }

  // Draw a classic arcade ghost using crisp SDFs in viewBox units (y-down)
  void drawGhost(
    vec2 p,
    vec2 center,
    vec2 lookDir,
    vec3 bodyCol,
    float phase,
    inout vec3 col
  ) {
    vec2 d = p - center;
    float r = 1.38;
    if (abs(d.x) > r + 0.6 || abs(d.y) > r + 0.8) return;

    // Semicircle head (top half: d.y <= 0) + skirt body (bottom half: d.y > 0)
    float headD = length(vec2(d.x, d.y + 0.12)) - r;
    float wave = sin(d.x * 4.8 + phase) * 0.22;
    float skirtBottom = 1.28 + wave;
    float bodyBox = max(abs(d.x) - r, max(-d.y - 0.12, d.y - skirtBottom));
    float ghostSdf = min(headD, bodyBox);

    // Subtle neon aura behind the ghost inside the dark corridor
    float aura = exp(-max(ghostSdf, 0.0) * 1.9) * 0.34;
    col += bodyCol * aura;

    if (ghostSdf < 0.08) {
      float bodyMask = 1.0 - smoothstep(-0.10, 0.08, ghostSdf);
      // Slight glossy arcade highlight near top dome
      float highlight = smoothstep(0.55, -0.8, d.y + d.x * 0.35) * 0.16;
      vec3 shaded = clamp(bodyCol + highlight, 0.0, 1.0);
      col = mix(col, shaded, bodyMask);

      // Eyes (two white ovals + cobalt pupils tracking Pac-Man)
      vec2 eyeL = d - vec2(-0.46, -0.22);
      vec2 eyeR = d - vec2(0.46, -0.22);
      float scleraL = length(vec2(eyeL.x * 1.18, eyeL.y * 0.92)) - 0.36;
      float scleraR = length(vec2(eyeR.x * 1.18, eyeR.y * 0.92)) - 0.36;
      float sclera = min(scleraL, scleraR);
      if (sclera < 0.06) {
        float sMask = (1.0 - smoothstep(-0.07, 0.06, sclera)) * bodyMask;
        col = mix(col, vec3(1.0), sMask);

        vec2 pOff = lookDir * 0.15;
        float pupL = length(eyeL - pOff) - 0.17;
        float pupR = length(eyeR - pOff) - 0.17;
        float pup = min(pupL, pupR);
        if (pup < 0.05) {
          float pMask = (1.0 - smoothstep(-0.06, 0.05, pup)) * sMask;
          col = mix(col, vec3(0.05, 0.22, 0.78), pMask);
        }
      }
    }
  }

  void main() {
    // ViewBox coordinates: x in [0..195] left-to-right, y in [0..36] top-to-bottom
    vec2 p = vec2(vUv.x * VB_W, (1.0 - vUv.y) * VB_H);
    vec4 maskData = texture2D(uMaskTex, vUv);

    if (maskData.r < 0.5) {
      discard;
    }

    vec3 sodiumCol = vec3(0.95294, 0.67451, 0.94118); // exact #F3ACF0

    int letterIdx = int(floor(maskData.g * 4.0 + 0.5));
    float h = 0.0;
    vec2 pacPos = vec2(0.0);
    vec2 pacDir = vec2(1.0, 0.0);
    vec2 g1Pos = vec2(0.0);
    vec2 g1Dir = vec2(1.0, 0.0);
    vec2 g2Pos = vec2(0.0);
    vec2 g2Dir = vec2(1.0, 0.0);

    // Constant-index loop for strict WebGL1 / GLSL ES 1.00 compatibility
    for (int i = 0; i < 5; i++) {
      if (i == letterIdx) {
        h = uHover[i];
        pacPos = uPacPos[i];
        pacDir = uPacDir[i];
        g1Pos = uGhost1Pos[i];
        g1Dir = uGhost1Dir[i];
        g2Pos = uGhost2Pos[i];
        g2Dir = uGhost2Dir[i];
      }
    }

    if (h <= 0.002) {
      gl_FragColor = vec4(sodiumCol, 1.0);
      return;
    }

    // 1. Arcade corridor background with subtle CRT scanline texture
    float scan = 0.93 + 0.07 * sin(p.y * 10.5 + uTime * 3.0);
    vec3 arcadeCol = vec3(0.035, 0.048, 0.118) * scan;

    // 2. Crisp neon blue maze walls hugging the inner boundary of the letter strokes
    float wallOuter = 0.48;
    float wallInner = 0.72;

    float minOuter = 1.0;
    minOuter = min(minOuter, sampleMaskAt(p + vec2(wallOuter, 0.0)));
    minOuter = min(minOuter, sampleMaskAt(p - vec2(wallOuter, 0.0)));
    minOuter = min(minOuter, sampleMaskAt(p + vec2(0.0, wallOuter)));
    minOuter = min(minOuter, sampleMaskAt(p - vec2(0.0, wallOuter)));
    minOuter = min(minOuter, sampleMaskAt(p + vec2(wallOuter * 0.75, wallOuter * 0.75)));
    minOuter = min(minOuter, sampleMaskAt(p + vec2(-wallOuter * 0.75, wallOuter * 0.75)));
    minOuter = min(minOuter, sampleMaskAt(p + vec2(wallOuter * 0.75, -wallOuter * 0.75)));
    minOuter = min(minOuter, sampleMaskAt(p + vec2(-wallOuter * 0.75, -wallOuter * 0.75)));

    float minInner = 1.0;
    minInner = min(minInner, sampleMaskAt(p + vec2(wallInner, 0.0)));
    minInner = min(minInner, sampleMaskAt(p - vec2(wallInner, 0.0)));
    minInner = min(minInner, sampleMaskAt(p + vec2(0.0, wallInner)));
    minInner = min(minInner, sampleMaskAt(p - vec2(0.0, wallInner)));

    // Outer maze neon wall + thin glowing inner rim
    vec3 wallCol = mix(vec3(0.137, 0.439, 0.910), vec3(0.953, 0.675, 0.941), 0.18 + 0.12 * sin(uTime * 3.2 + float(letterIdx)));
    if (minOuter < 0.5) {
      arcadeCol = wallCol;
    } else if (minInner < 0.5) {
      arcadeCol = mix(arcadeCol, vec3(0.32, 0.74, 1.0), 0.36);
    }

    // 3. Corridor pellets (and pulsing power pellets at corners/ends)
    vec2 cellIdx = floor(vec2(p.x / CELL_W, p.y / CELL_H));
    vec2 cellCenter = vec2((cellIdx.x + 0.5) * CELL_W, (cellIdx.y + 0.5) * CELL_H);
    float pelletVis = texture2D(uPelletTex, vUv).r;
    bool isPower = maskData.b > 0.5;

    if (pelletVis > 0.04) {
      float dPellet = length(p - cellCenter);
      float pRad = isPower ? (0.58 + 0.14 * sin(uTime * 8.5 + float(letterIdx))) : 0.33;
      float dotMask = (1.0 - smoothstep(pRad - 0.08, pRad + 0.08, dPellet)) * pelletVis;
      float dotGlow = exp(-dPellet * (isPower ? 1.8 : 3.2)) * (isPower ? 0.55 : 0.25) * pelletVis;
      vec3 pelletCol = isPower ? vec3(1.0, 0.88, 0.96) : vec3(1.0, 0.91, 0.68);
      arcadeCol += pelletCol * dotGlow;
      arcadeCol = mix(arcadeCol, pelletCol, dotMask);
    }

    // 4. Chasing Ghosts (Inky cyan trailing Blinky red)
    drawGhost(p, g2Pos, g2Dir, vec3(0.10, 0.88, 1.0), uTime * 11.0 + 1.8, arcadeCol);
    drawGhost(p, g1Pos, g1Dir, vec3(1.0, 0.18, 0.32), uTime * 12.5, arcadeCol);

    // 5. Pac-Man fleeing ahead with animated chomping mouth
    vec2 dp = p - pacPos;
    float pacR = 1.48;
    float dPac = length(dp);
    // Warm golden glow around Pac-Man
    arcadeCol += vec3(1.0, 0.88, 0.15) * exp(-max(dPac - pacR * 0.5, 0.0) * 1.85) * 0.34;

    if (dPac < pacR + 0.12) {
      // Rotate dp into Pac-Man's heading frame (x = forward, y = perpendicular)
      vec2 fwd = normalize(pacDir);
      vec2 perp = vec2(-fwd.y, fwd.x);
      vec2 lp = vec2(dot(dp, fwd), dot(dp, perp));

      float ang = dPac > 0.03 ? abs(atan(lp.y, lp.x)) : PI;
      float chomp = 0.08 + 0.66 * abs(sin(uTime * 12.5 + float(letterIdx) * 1.1));

      float circleMask = 1.0 - smoothstep(pacR - 0.10, pacR + 0.08, dPac);
      float mouthEdge = smoothstep(chomp - 0.09, chomp + 0.07, ang);
      float pacMask = circleMask * mouthEdge;

      vec3 pacCol = vec3(1.0, 0.90, 0.08);
      // Slight glossy arcade highlight
      float pacHi = smoothstep(0.6, -0.9, dp.y) * 0.12;
      arcadeCol = mix(arcadeCol, clamp(pacCol + pacHi, 0.0, 1.0), pacMask);

      // Crisp Pac-Man eye positioned consistently on the upper side of his head
      float upSign = fwd.x < -0.15 ? 1.0 : -1.0;
      vec2 eyeLocal = abs(fwd.y) > 0.7 ? vec2(-0.12, 0.62) : vec2(-0.10, upSign * 0.64);
      float dEye = length(lp - eyeLocal) - 0.21;
      if (dEye < 0.05) {
        float eMask = (1.0 - smoothstep(-0.06, 0.05, dEye)) * pacMask;
        arcadeCol = mix(arcadeCol, vec3(0.04, 0.04, 0.08), eMask);
      }
    }

    // 6. Smooth shader activation blend with crisp retro power-on flash
    float blend = smoothstep(0.0, 1.0, h);
    float flash = sin(blend * PI) * 0.26;
    vec3 finalCol = mix(sodiumCol, arcadeCol, blend) + vec3(0.35, 0.85, 1.0) * flash;

    gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
  }
`;

function buildMaskDataTexture(): {
  maskTex: THREE.DataTexture;
  cellMap: Int8Array;
} {
  const data = new Uint8Array(GRID_COLS * GRID_ROWS * 4);
  const cellMap = new Int8Array(GRID_COLS * GRID_ROWS).fill(-1);

  for (let li = 0; li < LETTER_GLYPHS.length; li++) {
    const letter = LETTER_GLYPHS[li];
    const powerSet = new Set(letter.powerCells.map(([c, r]) => `${c},${r}`));
    for (let r = 0; r < GRID_ROWS; r++) {
      const rowStr = letter.rows[r];
      for (let lc = 0; lc < rowStr.length; lc++) {
        if (rowStr[lc] !== '#') continue;
        const gc = letter.colOffset + lc;
        cellMap[r * GRID_COLS + gc] = li;
        // WebGL DataTexture row 0 is bottom (v=0), so flip Y to match vUv
        const texY = GRID_ROWS - 1 - r;
        const idx = (texY * GRID_COLS + gc) * 4;
        data[idx] = 255;
        data[idx + 1] = Math.round((li / 4) * 255);
        data[idx + 2] = powerSet.has(`${lc},${r}`) ? 255 : 0;
        data[idx + 3] = 255;
      }
    }
  }

  const maskTex = new THREE.DataTexture(data, GRID_COLS, GRID_ROWS, THREE.RGBAFormat);
  maskTex.minFilter = THREE.NearestFilter;
  maskTex.magFilter = THREE.NearestFilter;
  maskTex.wrapS = THREE.ClampToEdgeWrapping;
  maskTex.wrapT = THREE.ClampToEdgeWrapping;
  maskTex.generateMipmaps = false;
  maskTex.needsUpdate = true;
  return { maskTex, cellMap };
}

function buildPelletDataTexture(): {
  pelletTex: THREE.DataTexture;
  pelletData: Uint8Array;
} {
  const pelletData = new Uint8Array(GRID_COLS * GRID_ROWS * 4);
  for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
    pelletData[i * 4] = 255;
    pelletData[i * 4 + 1] = 255;
    pelletData[i * 4 + 2] = 255;
    pelletData[i * 4 + 3] = 255;
  }
  const pelletTex = new THREE.DataTexture(pelletData, GRID_COLS, GRID_ROWS, THREE.RGBAFormat);
  pelletTex.minFilter = THREE.NearestFilter;
  pelletTex.magFilter = THREE.NearestFilter;
  pelletTex.wrapS = THREE.ClampToEdgeWrapping;
  pelletTex.wrapT = THREE.ClampToEdgeWrapping;
  pelletTex.generateMipmaps = false;
  pelletTex.needsUpdate = true;
  return { pelletTex, pelletData };
}

function attachShaderToSvg(svg: SVGSVGElement): () => void {
  const parent = svg.parentElement;
  if (!parent) return () => {};

  // Avoid double-mounting on the same SVG
  if (parent.querySelector('.footer-logo-shader-canvas')) {
    return () => {};
  }

  const isSoftwareGl = detectSoftwareWebGL();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
  } catch {
    // Graceful fallback: keep the crisp original SVG visible
    return () => {};
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

  const canvas = renderer.domElement;
  canvas.className = 'footer-logo-shader-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  parent.classList.add('footer-logo-stage');
  parent.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const { maskTex, cellMap } = buildMaskDataTexture();
  const { pelletTex, pelletData } = buildPelletDataTexture();
  const compiledPaths = compileLetterPaths();

  const hoverVals = [0, 0, 0, 0, 0];
  const progressDist = [0, 14, 28, 8, 18];
  const pacPosArr = Array.from({ length: 5 }, () => new THREE.Vector2());
  const pacDirArr = Array.from({ length: 5 }, () => new THREE.Vector2(1, 0));
  const g1PosArr = Array.from({ length: 5 }, () => new THREE.Vector2());
  const g1DirArr = Array.from({ length: 5 }, () => new THREE.Vector2(1, 0));
  const g2PosArr = Array.from({ length: 5 }, () => new THREE.Vector2());
  const g2DirArr = Array.from({ length: 5 }, () => new THREE.Vector2(1, 0));

  // Per-cell pellet state (1 = visible, 0 = eaten, regrows smoothly after ghosts pass)
  const pelletLevel = new Float32Array(GRID_COLS * GRID_ROWS).fill(1);
  const pelletCooldown = new Float32Array(GRID_COLS * GRID_ROWS).fill(0);

  const uniforms = {
    uTime: { value: 0 },
    uMaskTex: { value: maskTex },
    uPelletTex: { value: pelletTex },
    uHover: { value: hoverVals },
    uPacPos: { value: pacPosArr },
    uPacDir: { value: pacDirArr },
    uGhost1Pos: { value: g1PosArr },
    uGhost1Dir: { value: g1DirArr },
    uGhost2Pos: { value: g2PosArr },
    uGhost2Dir: { value: g2DirArr },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(geometry, material);
  scene.add(quad);

  let hoveredLetter = -1;
  let pinnedLetter = -1; // Touch tap toggle support
  let inView = true;
  let disposed = false;
  let running = false;
  let frameId = 0;
  let lastTs = 0;
  let elapsed = 0;

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function syncSize(): boolean {
    const rect = svg.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w <= 1 || h <= 1) return false;
    renderer.setSize(w, h, false);
    return true;
  }

  function updateChaseState(dt: number): boolean {
    const reduced = reducedMotionQuery.matches;
    const activeTarget = hoveredLetter >= 0 ? hoveredLetter : pinnedLetter;
    let needsMoreFrames = false;
    let pelletDirty = false;

    for (let i = 0; i < 5; i++) {
      const target = i === activeTarget ? 1 : 0;
      const speed = target > hoverVals[i] ? 6.5 : 4.2;
      const prev = hoverVals[i];
      if (Math.abs(target - prev) < 0.004) {
        hoverVals[i] = target;
      } else {
        hoverVals[i] = prev + (target - prev) * Math.min(1, dt * speed);
        needsMoreFrames = true;
      }

      if (hoverVals[i] > 0.002) {
        needsMoreFrames = true;
        // Advance Pac-Man along the letter's exact corridor path
        const chaseRate = reduced ? 6.5 : 22.0; // viewBox units / sec (~4.4 cells/sec)
        progressDist[i] += dt * chaseRate;

        const path = compiledPaths[i];
        const pacD = progressDist[i];
        const pac = samplePath(path, pacD);
        pacPosArr[i].set(pac.x, pac.y);
        pacDirArr[i].set(pac.dx, pac.dy);

        // Dynamic pursuit distance: Blinky closes in & eases slightly around corners
        const pulseGap = Math.sin(elapsed * 2.4 + i * 1.7) * 1.4;
        const g1 = samplePath(path, pacD - (9.2 + pulseGap));
        const g2 = samplePath(path, pacD - (18.2 - pulseGap * 0.6));

        g1PosArr[i].set(g1.x, g1.y);
        g2PosArr[i].set(g2.x, g2.y);

        // Ghosts always look eagerly toward Pac-Man
        const d1x = pac.x - g1.x;
        const d1y = pac.y - g1.y;
        const m1 = Math.hypot(d1x, d1y) || 1;
        g1DirArr[i].set(d1x / m1, d1y / m1);

        const d2x = pac.x - g2.x;
        const d2y = pac.y - g2.y;
        const m2 = Math.hypot(d2x, d2y) || 1;
        g2DirArr[i].set(d2x / m2, d2y / m2);

        // Pac-Man eats pellets in the cell he passes through
        const pc = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(pac.x / CELL_W)));
        const pr = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(pac.y / CELL_H)));
        const cellIdx = pr * GRID_COLS + pc;
        if (cellMap[cellIdx] === i && pelletLevel[cellIdx] > 0.05) {
          pelletLevel[cellIdx] = 0;
          pelletCooldown[cellIdx] = 1.65;
          pelletDirty = true;
        }
      }
    }

    // Regrow eaten pellets smoothly once the ghosts have passed
    for (let idx = 0; idx < GRID_COLS * GRID_ROWS; idx++) {
      if (cellMap[idx] < 0) continue;
      if (pelletCooldown[idx] > 0) {
        pelletCooldown[idx] = Math.max(0, pelletCooldown[idx] - dt);
        if (pelletCooldown[idx] === 0) {
          pelletDirty = true;
        }
      } else if (pelletLevel[idx] < 1) {
        pelletLevel[idx] = Math.min(1, pelletLevel[idx] + dt * 2.4);
        pelletDirty = true;
      }
    }

    if (pelletDirty) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const texY = GRID_ROWS - 1 - r;
        for (let c = 0; c < GRID_COLS; c++) {
          const val = Math.round(pelletLevel[r * GRID_COLS + c] * 255);
          const off = (texY * GRID_COLS + c) * 4;
          pelletData[off] = val;
        }
      }
      pelletTex.needsUpdate = true;
    }

    return needsMoreFrames;
  }

  function scheduleNextFrame(cb: () => void): void {
    if (disposed) return;
    if (isSoftwareGl) {
      const gl = renderer.getContext();
      if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (st === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
        return;
      }
      frameId = window.setTimeout(cb, 80);
      return;
    }
    frameId = window.requestAnimationFrame(cb);
  }

  function stopLoop(): void {
    running = false;
    if (frameId) {
      if (isSoftwareGl) window.clearTimeout(frameId);
      else window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function renderOnce(): void {
    if (disposed) return;
    syncSize();
    uniforms.uTime.value = elapsed;
    renderer.render(scene, camera);
    svg.classList.add('is-shader-active');
  }

  function tick(): void {
    if (disposed || !running) return;
    const now = performance.now();
    const dt = lastTs > 0 ? Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000)) : 1 / 60;
    lastTs = now;
    elapsed += dt;

    const keepGoing = updateChaseState(dt);
    uniforms.uTime.value = elapsed;
    renderer.render(scene, camera);
    svg.classList.add('is-shader-active');

    if (keepGoing && inView && !document.hidden) {
      scheduleNextFrame(tick);
    } else {
      running = false;
      frameId = 0;
    }
  }

  function ensureRunning(): void {
    if (disposed || !inView || document.hidden) return;
    if (running) return;
    running = true;
    lastTs = performance.now();
    scheduleNextFrame(tick);
  }

  function letterIndexFromPointer(clientX: number, clientY: number): number {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return -1;
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return -1;

    const col = nx * GRID_COLS;
    for (let i = 0; i < LETTER_GLYPHS.length; i++) {
      const start = LETTER_GLYPHS[i].colOffset;
      const end = start + 7;
      if (col >= start - 0.35 && col <= end + 0.35) {
        return i;
      }
    }
    return -1;
  }

  const onPointerMove = (e: PointerEvent) => {
    const next = letterIndexFromPointer(e.clientX, e.clientY);
    if (next !== hoveredLetter) {
      hoveredLetter = next;
      canvas.style.cursor = next >= 0 ? 'pointer' : '';
      ensureRunning();
    }
  };

  const onPointerLeave = () => {
    if (hoveredLetter !== -1) {
      hoveredLetter = -1;
      canvas.style.cursor = '';
      ensureRunning();
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const idx = letterIndexFromPointer(e.clientX, e.clientY);
    pinnedLetter = idx === pinnedLetter ? -1 : idx;
    ensureRunning();
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);

  const onVisibilityChange = () => {
    if (document.hidden) {
      stopLoop();
    } else if (hoveredLetter >= 0 || pinnedLetter >= 0 || hoverVals.some((v) => v > 0.002)) {
      ensureRunning();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const resizeObserver = new ResizeObserver(() => {
    renderOnce();
  });
  resizeObserver.observe(svg);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      inView = visible;
      if (!visible) {
        stopLoop();
      } else {
        renderOnce();
        if (hoveredLetter >= 0 || pinnedLetter >= 0 || hoverVals.some((v) => v > 0.002)) {
          ensureRunning();
        }
      }
    },
    { threshold: 0.02 }
  );
  intersectionObserver.observe(canvas);

  // Initial static frame matches solid #F3ACF0 wordmark immediately
  updateChaseState(0);
  renderOnce();

  return () => {
    disposed = true;
    stopLoop();
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    svg.classList.remove('is-shader-active');
    parent.classList.remove('footer-logo-stage');
    canvas.remove();
    geometry.dispose();
    material.dispose();
    maskTex.dispose();
    pelletTex.dispose();
    renderer.dispose();
  };
}

export function initFooterLogoShader(): () => void {
  let activeCleanup: (() => void) | null = null;
  let observer: MutationObserver | null = null;

  const tryMount = (): boolean => {
    const svg = document.querySelector<SVGSVGElement>(
      'footer#site-footer > div:nth-of-type(1) > div:nth-of-type(1) > svg:nth-of-type(1)'
    );
    if (!svg) return false;
    activeCleanup = attachShaderToSvg(svg);
    return true;
  };

  if (!tryMount()) {
    const footer = document.getElementById('site-footer');
    if (footer) {
      observer = new MutationObserver(() => {
        if (tryMount() && observer) {
          observer.disconnect();
          observer = null;
        }
      });
      observer.observe(footer, { childList: true, subtree: true });
    }
  }

  return () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  };
}
