import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  VRM,
  VRMLoaderPlugin,
  VRMUtils,
  VRMExpressionPresetName,
  VRMHumanBoneName,
} from '@pixiv/three-vrm';
import {
  getExaminerSettings,
  saveCustomAvatarToDb,
  loadCustomAvatarFromDb,
  deleteCustomAvatarFromDb,
} from './examinerSettings';

export type ExaminerMood = 'idle' | 'listening' | 'speaking' | 'thinking';
export type ExaminerCameraPreset = 'front' | 'closeup' | 'desk';
export type BuiltInAvatarId = 'examiner-a' | 'examiner-b';

export interface AvatarStatus {
  state: 'loading' | 'ready' | 'error';
  label: string;
  format: 'VRM 1.0' | 'VRM 0.x' | 'GLB / Live3D' | 'Loading';
  progress?: number;
  error?: string;
  presetId: BuiltInAvatarId | 'custom';
}

export interface BuiltInAvatarPreset {
  id: BuiltInAvatarId;
  name: string;
  subtitle: string;
  url: string;
}

export const BUILTIN_AVATARS: BuiltInAvatarPreset[] = [
  {
    id: 'examiner-a',
    name: 'Examiner Claire',
    subtitle: 'VRoid Studio VRM Avatar',
    url: '/models/examiner_a.vrm',
  },
  {
    id: 'examiner-b',
    name: 'Examiner Kenji',
    subtitle: 'VRoid Studio VRM Avatar',
    url: '/models/examiner_b.vrm',
  },
];

export interface Examiner3DController {
  mount: (container: HTMLElement) => void;
  unmount: () => void;
  setAudioLevels: (examinerLevel: number, studentLevel: number) => void;
  setMood: (mood: ExaminerMood) => void;
  setCameraPreset: (preset: ExaminerCameraPreset) => void;
  loadPreset: (presetId: BuiltInAvatarId) => Promise<void>;
  loadAvatarFile: (file: File) => Promise<void>;
  loadAvatarUrl: (url: string, label?: string) => Promise<void>;
  clearCustomAvatar: () => Promise<void>;
  applySavedSettings: () => Promise<void>;
  setPaused: (paused: boolean) => void;
  getStatus: () => AvatarStatus;
  onStatusChange: (listener: (status: AvatarStatus) => void) => () => void;
}

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function makeBackdropGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#FAF1FA');
    grad.addColorStop(1, '#EFE0EF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.strokeStyle = 'rgba(10, 10, 10, 0.06)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= 1024; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(10, 10, 10, 0.72)';
    ctx.font = '700 22px "Inter Tight", sans-serif';
    ctx.fillText('IEAFL · VRM / LIVE3D EXAMINER STUDIO', 44, 58);
    ctx.fillStyle = '#2370E8';
    ctx.fillRect(44, 72, 112, 5);
    ctx.fillStyle = '#F3ACF0';
    ctx.fillRect(162, 72, 42, 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function makeContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 120);
    grad.addColorStop(0, 'rgba(10, 10, 10, 0.36)');
    grad.addColorStop(0.55, 'rgba(10, 10, 10, 0.12)');
    grad.addColorStop(1, 'rgba(10, 10, 10, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Pre-allocated math helpers outside render loop (zero GC)
const _camTargetPos = new THREE.Vector3();
const _lookAtTarget = new THREE.Vector3();
const _headWorldPos = new THREE.Vector3();
const _box = new THREE.Box3();
const _boxSize = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();
const _ringColor = new THREE.Color();
const _ringColorSpeaking = new THREE.Color('#2370E8');
const _ringColorListening = new THREE.Color('#22C98A');
const _ringColorThinking = new THREE.Color('#A98BF7');
const _ringColorIdle = new THREE.Color('#0A0A0A');

interface GlbRig {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  headBone: THREE.Object3D | null;
  neckBone: THREE.Object3D | null;
  spineBone: THREE.Object3D | null;
  morphMeshes: Array<{
    mesh: THREE.Mesh;
    dict: Record<string, number>;
  }>;
  baseHeadRot: THREE.Euler;
  baseSpineRot: THREE.Euler;
}

export function createExaminer3DController(): Examiner3DController {
  let hostEl: HTMLElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let frameId = 0;
  let isMounted = false;
  let isSoftwareGl = false;

  // Shared GLTF + VRM loader
  const gltfLoader = new GLTFLoader();
  gltfLoader.register((parser) => new VRMLoaderPlugin(parser));

  // Avatar state
  let currentVrm: VRM | null = null;
  let currentGlbRig: GlbRig | null = null;
  let avatarRootGroup: THREE.Group | null = null;
  let lookAtTargetObj: THREE.Object3D | null = null;
  let micRingMat: THREE.MeshStandardMaterial | null = null;
  let avatarLoadToken = 0;
  let activeBlobUrl: string | null = null;
  let avatarEyeY = 1.45;
  let avatarInitialized = false;

  // Pointer-driven subtle eye contact offset
  let pointerNdcX = 0;
  let pointerNdcY = 0;

  // Live animation state
  let targetExaminerLevel = 0;
  let targetStudentLevel = 0;
  let smoothExaminerLevel = 0;
  let smoothStudentLevel = 0;
  let currentMood: ExaminerMood = 'idle';
  let currentPreset: ExaminerCameraPreset = 'front';
  let isCameraTransitioning = false;
  let isPaused = false;
  let elapsedAnimTime = 0;
  let blinkTimer = 2.6;
  let blinkAmount = 0;

  // Status notifications
  let status: AvatarStatus = {
    state: 'loading',
    label: BUILTIN_AVATARS[0].name,
    format: 'Loading',
    progress: 0,
    presetId: 'examiner-a',
  };
  const statusListeners = new Set<(s: AvatarStatus) => void>();

  function emitStatus(next: AvatarStatus): void {
    status = next;
    statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch {
        // ignore listener error
      }
    });
  }

  const sceneDisposables: Array<{ dispose: () => void }> = [];
  function trackScene<T extends { dispose: () => void }>(res: T): T {
    sceneDisposables.push(res);
    return res;
  }

  function computeCameraPreset(preset: ExaminerCameraPreset): {
    pos: [number, number, number];
    target: [number, number, number];
  } {
    const eye = avatarEyeY;
    if (preset === 'closeup') {
      return {
        pos: [0.02, eye - 0.02, 1.05],
        target: [0, eye - 0.06, 0],
      };
    }
    if (preset === 'desk') {
      return {
        pos: [0.92, eye + 0.06, 2.42],
        target: [0, eye - 0.28, 0.18],
      };
    }
    // 'front' — balanced studio portrait framing both examiner and studio desk
    return {
      pos: [0, eye - 0.04, 2.38],
      target: [0, eye - 0.3, 0.16],
    };
  }

  function snapCameraToPreset(preset: ExaminerCameraPreset): void {
    if (!camera || !controls) return;
    const cfg = computeCameraPreset(preset);
    camera.position.set(...cfg.pos);
    controls.target.set(...cfg.target);
    controls.update();
    isCameraTransitioning = false;
  }

  function disposeCurrentAvatar(): void {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }
    if (currentVrm) {
      if (avatarRootGroup) avatarRootGroup.remove(currentVrm.scene);
      try {
        VRMUtils.deepDispose(currentVrm.scene);
      } catch {
        // ignore
      }
      currentVrm = null;
    }
    if (currentGlbRig) {
      currentGlbRig.mixer?.stopAllAction();
      if (avatarRootGroup) avatarRootGroup.remove(currentGlbRig.root);
      try {
        VRMUtils.deepDispose(currentGlbRig.root);
      } catch {
        // ignore
      }
      currentGlbRig = null;
    }
  }

  function getVrmDownArmSign(vrm: VRM): number {
    // VRM 0.x normalized bones face -Z locally (left arm along -X -> +Z lowers arm);
    // VRM 1.0 normalized bones face +Z locally (left arm along +X -> -Z lowers arm).
    const h = vrm.humanoid;
    const leftLower = h?.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
    if (leftLower && Math.abs(leftLower.position.x) > 0.01) {
      return leftLower.position.x < 0 ? 1 : -1;
    }
    return vrm.meta?.metaVersion === '1' ? -1 : 1;
  }

  function applyRelaxedVrmPose(vrm: VRM): void {
    const h = vrm.humanoid;
    if (!h) return;
    const downSign = getVrmDownArmSign(vrm);
    const setRot = (name: VRMHumanBoneName, x: number, y: number, z: number): void => {
      const node = h.getNormalizedBoneNode(name);
      if (node) {
        node.rotation.set(x, y, z);
      }
    };
    // Lower arms out of T-pose into natural composed examiner posture
    setRot(VRMHumanBoneName.LeftShoulder, 0, 0, 0.05 * downSign);
    setRot(VRMHumanBoneName.RightShoulder, 0, 0, -0.05 * downSign);
    setRot(VRMHumanBoneName.LeftUpperArm, 0.08 * downSign, -0.06 * downSign, 1.24 * downSign);
    setRot(VRMHumanBoneName.RightUpperArm, 0.08 * downSign, 0.06 * downSign, -1.24 * downSign);
    setRot(VRMHumanBoneName.LeftLowerArm, 0.06, -0.38, 0.04 * downSign);
    setRot(VRMHumanBoneName.RightLowerArm, 0.06, 0.38, -0.04 * downSign);
    setRot(VRMHumanBoneName.LeftHand, 0.03, 0, -0.05 * downSign);
    setRot(VRMHumanBoneName.RightHand, 0.03, 0, 0.05 * downSign);
  }

  function normalizeAndFrameAvatar(rootObj: THREE.Object3D, vrm: VRM | null): void {
    if (!avatarRootGroup) return;
    rootObj.updateMatrixWorld(true);
    _box.setFromObject(rootObj);
    _box.getSize(_boxSize);
    _box.getCenter(_boxCenter);

    // Normalize extreme scales (e.g. centimeter GLB exports) to ~1.62m standing height
    const height = _boxSize.y;
    if (height > 0.01 && (height < 0.7 || height > 2.6)) {
      const scale = 1.62 / height;
      rootObj.scale.multiplyScalar(scale);
      rootObj.updateMatrixWorld(true);
      _box.setFromObject(rootObj);
      _box.getSize(_boxSize);
      _box.getCenter(_boxCenter);
    }

    // Center X/Z and place feet flush on studio floor (y = 0)
    rootObj.position.x -= _boxCenter.x;
    rootObj.position.z -= _boxCenter.z;
    rootObj.position.y -= _box.min.y;
    rootObj.updateMatrixWorld(true);

    // Determine exact head/eye height for studio portrait framing
    let measuredEyeY = _box.min.y + _boxSize.y * 0.87;
    if (vrm?.humanoid) {
      const headNode = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
      if (headNode) {
        headNode.getWorldPosition(_headWorldPos);
        measuredEyeY = _headWorldPos.y + 0.07;
      }
    } else if (currentGlbRig?.headBone) {
      currentGlbRig.headBone.getWorldPosition(_headWorldPos);
      measuredEyeY = _headWorldPos.y + 0.05;
    }

    avatarEyeY = THREE.MathUtils.clamp(measuredEyeY, 0.85, 2.0);
    snapCameraToPreset(currentPreset);
  }

  async function loadAvatarInternal(
    url: string,
    label: string,
    presetId: BuiltInAvatarId | 'custom',
    isObjectUrl = false
  ): Promise<void> {
    const token = ++avatarLoadToken;
    emitStatus({
      state: 'loading',
      label,
      format: 'Loading',
      progress: 5,
      presetId,
    });

    try {
      const gltf = await new Promise<{
        scene: THREE.Group;
        animations: THREE.AnimationClip[];
        userData: Record<string, unknown>;
      }>((resolve, reject) => {
        gltfLoader.load(
          url,
          (loaded) => resolve(loaded),
          (evt) => {
            if (token !== avatarLoadToken) return;
            if (evt.total > 0) {
              const pct = Math.min(99, Math.max(5, Math.round((evt.loaded / evt.total) * 100)));
              emitStatus({
                state: 'loading',
                label,
                format: 'Loading',
                progress: pct,
                presetId,
              });
            }
          },
          (err) => reject(err)
        );
      });

      if (token !== avatarLoadToken || !isMounted || !avatarRootGroup) {
        if (isObjectUrl) URL.revokeObjectURL(url);
        return;
      }

      disposeCurrentAvatar();
      if (isObjectUrl) {
        activeBlobUrl = url;
      }

      const vrm = (gltf.userData.vrm as VRM | undefined) || null;

      if (vrm) {
        try {
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
        } catch {
          // Some VRM 0.x / custom models skip optimization safely
        }

        // VRM 0.x models face -Z by spec; rotate to face +Z toward camera
        VRMUtils.rotateVRM0(vrm);

        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = !isSoftwareGl;
            mesh.receiveShadow = false;
          }
        });

        applyRelaxedVrmPose(vrm);

        if (vrm.lookAt && lookAtTargetObj) {
          vrm.lookAt.target = lookAtTargetObj;
        }

        currentVrm = vrm;
        avatarRootGroup.add(vrm.scene);
        vrm.update(0.016);
        normalizeAndFrameAvatar(vrm.scene, vrm);

        const isVrm1 = vrm.meta?.metaVersion === '1';
        const metaName =
          vrm.meta && 'name' in vrm.meta && typeof vrm.meta.name === 'string' && vrm.meta.name.trim()
            ? vrm.meta.name.trim()
            : label;
        const displayLabel = presetId === 'custom' ? label : `${label}`;

        emitStatus({
          state: 'ready',
          label: displayLabel || metaName,
          format: isVrm1 ? 'VRM 1.0' : 'VRM 0.x',
          progress: 100,
          presetId,
        });
      } else {
        // Generic Live3D / Ready Player Me / GLB / GLTF Avatar Support
        const model = gltf.scene;
        const morphMeshes: GlbRig['morphMeshes'] = [];
        let headBone: THREE.Object3D | null = null;
        let neckBone: THREE.Object3D | null = null;
        let spineBone: THREE.Object3D | null = null;

        model.traverse((obj) => {
          obj.frustumCulled = false;
          const lower = obj.name.toLowerCase();
          if (!headBone && /(^|[_:.\-\s])head($|[_:.\-\s0-9])/.test(lower)) headBone = obj;
          if (!neckBone && /(^|[_:.\-\s])neck($|[_:.\-\s0-9])/.test(lower)) neckBone = obj;
          if (!spineBone && /(spine2|spine1|upperchest|chest|spine)/.test(lower)) spineBone = obj;

          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = !isSoftwareGl;
            mesh.receiveShadow = true;
            if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
              morphMeshes.push({ mesh, dict: mesh.morphTargetDictionary });
            }
          }
        });

        let mixer: THREE.AnimationMixer | null = null;
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          const idleClip =
            gltf.animations.find((c) => /idle|breath|stand/i.test(c.name)) || gltf.animations[0];
          mixer.clipAction(idleClip).play();
        }

        currentGlbRig = {
          root: model,
          mixer,
          headBone,
          neckBone,
          spineBone,
          morphMeshes,
          baseHeadRot: headBone ? (headBone as THREE.Object3D).rotation.clone() : new THREE.Euler(),
          baseSpineRot: spineBone ? (spineBone as THREE.Object3D).rotation.clone() : new THREE.Euler(),
        };

        avatarRootGroup.add(model);
        normalizeAndFrameAvatar(model, null);

        emitStatus({
          state: 'ready',
          label,
          format: 'GLB / Live3D',
          progress: 100,
          presetId,
        });
      }
    } catch (err) {
      if (isObjectUrl) URL.revokeObjectURL(url);
      if (token !== avatarLoadToken) return;
      const msg = err instanceof Error ? err.message : 'Failed to parse 3D avatar file.';
      console.error('[Examiner3D Avatar Load Error]', msg);
      emitStatus({
        state: 'error',
        label,
        format: 'Loading',
        error: `Could not load "${label}". Make sure it is a valid .vrm or .glb model (and CORS-enabled if loaded via URL).`,
        presetId,
      });
    }
  }

  function setGlbMorph(
    rig: GlbRig,
    candidateNames: string[],
    value: number
  ): void {
    for (const entry of rig.morphMeshes) {
      const influences = entry.mesh.morphTargetInfluences;
      if (!influences) continue;
      for (const name of candidateNames) {
        const idx = entry.dict[name];
        if (idx !== undefined) {
          influences[idx] = value;
          break;
        }
      }
    }
  }

  function buildScene(width: number, height: number): void {
    isSoftwareGl = detectSoftwareGl();

    renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#F5EBF5');
    scene.fog = new THREE.Fog('#F5EBF5', 4.2, 10.5);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    trackScene(envTex);
    pmrem.dispose();

    camera = new THREE.PerspectiveCamera(28, width / Math.max(1, height), 0.1, 30);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.65;
    controls.maxDistance = 4.5;
    controls.minPolarAngle = Math.PI * 0.24;
    controls.maxPolarAngle = Math.PI * 0.66;
    controls.addEventListener('start', () => {
      // Cancel preset transition immediately when user grabs the viewport
      isCameraTransitioning = false;
    });

    snapCameraToPreset(currentPreset);

    // Balanced 3-Point Warm/Cool Studio Rig (tuned for both VRM MToon & PBR GLB)
    const hemiLight = new THREE.HemisphereLight(0xf2f7ff, 0x4b3b4c, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.55);
    keyLight.position.set(1.6, 2.6, 2.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -1.6;
    keyLight.shadow.camera.right = 1.6;
    keyLight.shadow.camera.top = 2.2;
    keyLight.shadow.camera.bottom = -0.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf3acf0, 0.9);
    rimLight.position.set(-1.8, 2.1, -1.6);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Architectural Swiss-grid studio backdrop wall
    const backWallGeo = trackScene(new THREE.PlaneGeometry(7.2, 4.0));
    const backWallTex = trackScene(makeBackdropGridTexture(maxAniso));
    const backWallMat = trackScene(
      new THREE.MeshStandardMaterial({
        map: backWallTex,
        roughness: 0.92,
        metalness: 0.02,
      })
    );
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 1.85, -1.25);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Studio floor + soft grounding contact shadow
    const floor = new THREE.Mesh(
      trackScene(new THREE.PlaneGeometry(12, 12)),
      trackScene(
        new THREE.MeshStandardMaterial({
          color: 0xebe0eb,
          roughness: 0.9,
          metalness: 0.04,
        })
      )
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const contactShadow = new THREE.Mesh(
      trackScene(new THREE.PlaneGeometry(1.1, 1.1)),
      trackScene(
        new THREE.MeshBasicMaterial({
          map: trackScene(makeContactShadowTexture()),
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        })
      )
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.005, 0);
    scene.add(contactShadow);

    // Minimalist Broadcast Studio Desk (low profile so avatar stays unobstructed)
    const deskGroup = new THREE.Group();
    const deskMat = trackScene(
      new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.42, metalness: 0.14 })
    );
    const deskTop = new THREE.Mesh(trackScene(new THREE.BoxGeometry(1.85, 0.055, 0.56)), deskMat);
    deskTop.position.set(0, 0.86, 0.46);
    deskTop.castShadow = !isSoftwareGl;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);

    // Audio-reactive static color accent bar on desk front edge
    micRingMat = trackScene(
      new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        emissive: 0x0a0a0a,
        emissiveIntensity: 0.65,
        roughness: 0.28,
        metalness: 0.2,
      })
    );
    const deskStatusStrip = new THREE.Mesh(
      trackScene(new THREE.BoxGeometry(1.85, 0.014, 0.014)),
      micRingMat
    );
    deskStatusStrip.position.set(0, 0.882, 0.742);
    deskGroup.add(deskStatusStrip);

    // Grounded architectural legs + front modesty apron so the studio table looks solid
    const legGeo = trackScene(new THREE.BoxGeometry(0.065, 0.835, 0.48));
    const leftLeg = new THREE.Mesh(legGeo, deskMat);
    leftLeg.position.set(-0.87, 0.4175, 0.46);
    leftLeg.castShadow = !isSoftwareGl;
    leftLeg.receiveShadow = true;
    deskGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, deskMat);
    rightLeg.position.set(0.87, 0.4175, 0.46);
    rightLeg.castShadow = !isSoftwareGl;
    rightLeg.receiveShadow = true;
    deskGroup.add(rightLeg);

    const apronMat = trackScene(
      new THREE.MeshStandardMaterial({ color: 0x1e1e24, roughness: 0.58, metalness: 0.1 })
    );
    const frontApron = new THREE.Mesh(
      trackScene(new THREE.BoxGeometry(1.68, 0.44, 0.03)),
      apronMat
    );
    frontApron.position.set(0, 0.615, 0.68);
    frontApron.receiveShadow = true;
    deskGroup.add(frontApron);

    // Subtle examiner rubric folio resting on the right side of the studio desk
    const folioMat = trackScene(
      new THREE.MeshStandardMaterial({ color: 0xf7f5f2, roughness: 0.85, metalness: 0.02 })
    );
    const folio = new THREE.Mesh(
      trackScene(new THREE.BoxGeometry(0.28, 0.012, 0.21)),
      folioMat
    );
    folio.position.set(0.44, 0.894, 0.46);
    folio.rotation.y = -0.14;
    folio.receiveShadow = true;
    deskGroup.add(folio);

    const folioStrip = new THREE.Mesh(
      trackScene(new THREE.BoxGeometry(0.28, 0.013, 0.028)),
      trackScene(new THREE.MeshStandardMaterial({ color: 0x2370e8, roughness: 0.5 }))
    );
    folioStrip.position.set(0.428, 0.8945, 0.37);
    folioStrip.rotation.y = -0.14;
    deskGroup.add(folioStrip);

    // Compact studio condenser mic off to left edge of desk
    const metalMat = trackScene(
      new THREE.MeshPhysicalMaterial({
        color: 0xd8dce4,
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.5,
      })
    );
    const micBase = new THREE.Mesh(
      trackScene(new THREE.CylinderGeometry(0.06, 0.068, 0.018, 20)),
      metalMat
    );
    micBase.position.set(-0.46, 0.896, 0.46);
    deskGroup.add(micBase);

    const micStem = new THREE.Mesh(
      trackScene(new THREE.CylinderGeometry(0.009, 0.011, 0.17, 14)),
      metalMat
    );
    micStem.position.set(-0.46, 0.985, 0.46);
    deskGroup.add(micStem);

    const micCap = new THREE.Mesh(
      trackScene(new THREE.CapsuleGeometry(0.026, 0.052, 8, 16)),
      trackScene(new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.36, metalness: 0.6 }))
    );
    micCap.position.set(-0.46, 1.08, 0.44);
    micCap.rotation.x = -0.35;
    deskGroup.add(micCap);

    scene.add(deskGroup);

    // LookAt target for lifelike VRM eye contact
    lookAtTargetObj = new THREE.Object3D();
    lookAtTargetObj.position.set(0, 1.45, 2.2);
    scene.add(lookAtTargetObj);

    // Root container for loaded VRM / Live3D GLB avatar
    avatarRootGroup = new THREE.Group();
    scene.add(avatarRootGroup);
  }

  function animateVrmAvatar(vrm: VRM, dt: number, t: number, vocalOpen: number): void {
    const h = vrm.humanoid;
    const expr = vrm.expressionManager;

    // 1. Subtle breathing & natural upper-body posture
    const spine = h?.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    const chest = h?.getNormalizedBoneNode(VRMHumanBoneName.Chest);
    const neck = h?.getNormalizedBoneNode(VRMHumanBoneName.Neck);
    const head = h?.getNormalizedBoneNode(VRMHumanBoneName.Head);

    const breath = Math.sin(t * 1.45) * 0.016;
    if (spine) {
      spine.rotation.x = THREE.MathUtils.damp(spine.rotation.x, breath, 6, dt);
    }
    if (chest) {
      chest.rotation.x = THREE.MathUtils.damp(chest.rotation.x, breath * 0.7, 6, dt);
      chest.rotation.y = THREE.MathUtils.damp(chest.rotation.y, Math.sin(t * 0.38) * 0.025, 4, dt);
    }

    // 2. Expressive Head & Neck Kinematics (speaking, attentive listening nods, thinking tilt)
    let targetPitch = Math.sin(t * 0.85) * 0.024;
    let targetYaw = Math.sin(t * 0.52) * 0.04 + pointerNdcX * 0.07;
    let targetRoll = Math.sin(t * 0.41) * 0.022;

    if (currentMood === 'speaking' || smoothExaminerLevel > 0.04) {
      targetPitch += Math.sin(t * 4.4) * 0.032 * Math.min(1, smoothExaminerLevel * 3.0);
      targetYaw += Math.sin(t * 1.7) * 0.055;
      targetRoll += Math.sin(t * 2.1) * 0.025;
    } else if (currentMood === 'listening') {
      targetPitch += 0.035 + Math.sin(t * 2.7) * 0.042 * Math.min(1, 0.28 + smoothStudentLevel * 2.4);
      targetRoll += 0.038;
    } else if (currentMood === 'thinking') {
      targetPitch -= 0.05;
      targetYaw += 0.09;
      targetRoll -= 0.03;
    }

    if (neck) {
      neck.rotation.x = THREE.MathUtils.damp(neck.rotation.x, targetPitch * 0.45, 6, dt);
      neck.rotation.y = THREE.MathUtils.damp(neck.rotation.y, targetYaw * 0.45, 5, dt);
      neck.rotation.z = THREE.MathUtils.damp(neck.rotation.z, targetRoll * 0.45, 5, dt);
    }
    if (head) {
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, targetPitch * 0.55, 6, dt);
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, targetYaw * 0.55, 5, dt);
      head.rotation.z = THREE.MathUtils.damp(head.rotation.z, targetRoll * 0.55, 5, dt);
    }

    // Subtle speaking & breathing arm motion keeping both arms relaxed downward
    const downSign = getVrmDownArmSign(vrm);
    const leftUpper = h?.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
    const leftLower = h?.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
    const rightUpper = h?.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
    const rightLower = h?.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
    const idleArmBreath = Math.sin(t * 1.45 + 0.4) * 0.014;
    const speakWave =
      currentMood === 'speaking' ? Math.sin(t * 2.6) * 0.045 * (0.35 + vocalOpen) : 0;

    if (leftUpper && leftLower) {
      leftUpper.rotation.z = THREE.MathUtils.damp(
        leftUpper.rotation.z,
        (1.24 - idleArmBreath - speakWave * 0.35) * downSign,
        6,
        dt
      );
      leftLower.rotation.y = THREE.MathUtils.damp(
        leftLower.rotation.y,
        -0.38 - speakWave * 0.5,
        6,
        dt
      );
    }
    if (rightUpper && rightLower) {
      rightUpper.rotation.z = THREE.MathUtils.damp(
        rightUpper.rotation.z,
        (-1.24 + idleArmBreath + speakWave) * downSign,
        6,
        dt
      );
      rightLower.rotation.y = THREE.MathUtils.damp(
        rightLower.rotation.y,
        0.38 + speakWave * 1.25,
        6,
        dt
      );
    }

    // 3. Eye Contact Target (gently tracks camera + pointer)
    if (lookAtTargetObj && camera) {
      const gx = camera.position.x + pointerNdcX * 0.42 + Math.sin(t * 0.7) * 0.05;
      const gy =
        avatarEyeY +
        (currentMood === 'thinking' ? 0.18 : 0) +
        pointerNdcY * 0.22 +
        Math.cos(t * 0.5) * 0.03;
      lookAtTargetObj.position.x = THREE.MathUtils.damp(lookAtTargetObj.position.x, gx, 5, dt);
      lookAtTargetObj.position.y = THREE.MathUtils.damp(lookAtTargetObj.position.y, gy, 5, dt);
      lookAtTargetObj.position.z = Math.max(1.4, camera.position.z);
    }

    // 4. Real-Time 5-Vowel Viseme Lip-Sync + Natural Blinking + Mood Expressions
    if (expr) {
      // Multi-vowel formant modulation so speech articulates smoothly across aa/oh/ih/ee/ou
      const vAa = vocalOpen * (0.55 + 0.45 * Math.max(0, Math.sin(t * 14.2)));
      const vOh = vocalOpen * (0.35 * Math.max(0, Math.sin(t * 9.6 + 1.4)));
      const vIh = vocalOpen * (0.32 * Math.max(0, Math.cos(t * 11.8 + 0.5)));
      const vEe = vocalOpen * (0.24 * Math.max(0, Math.sin(t * 16.5 + 2.3)));
      const vOu = vocalOpen * (0.28 * Math.max(0, Math.cos(t * 7.8 + 2.1)));

      expr.setValue(VRMExpressionPresetName.Aa, THREE.MathUtils.clamp(vAa, 0, 0.92));
      expr.setValue(VRMExpressionPresetName.Oh, THREE.MathUtils.clamp(vOh, 0, 0.7));
      expr.setValue(VRMExpressionPresetName.Ih, THREE.MathUtils.clamp(vIh, 0, 0.65));
      expr.setValue(VRMExpressionPresetName.Ee, THREE.MathUtils.clamp(vEe, 0, 0.55));
      expr.setValue(VRMExpressionPresetName.Ou, THREE.MathUtils.clamp(vOu, 0, 0.6));

      // Natural blinking
      const blinkWeight = Math.sin(blinkAmount * Math.PI);
      expr.setValue(VRMExpressionPresetName.Blink, blinkWeight);

      // Subtle warm mood smile / composure
      const targetHappy =
        currentMood === 'listening' ? 0.22 : currentMood === 'speaking' ? 0.14 : 0.08;
      const prevHappy = expr.getValue(VRMExpressionPresetName.Happy) ?? 0;
      expr.setValue(
        VRMExpressionPresetName.Happy,
        THREE.MathUtils.damp(prevHappy, targetHappy, 4, dt)
      );
    }

    // 5. Advance VRM SpringBones (hair, ribbon, collar physics) + ExpressionManager + LookAt
    vrm.update(dt);
  }

  function animateGlbAvatar(rig: GlbRig, dt: number, t: number, vocalOpen: number): void {
    rig.mixer?.update(dt);

    if (rig.spineBone) {
      rig.spineBone.rotation.x = rig.baseSpineRot.x + Math.sin(t * 1.45) * 0.015;
    }
    if (rig.headBone) {
      const pitch =
        rig.baseHeadRot.x +
        Math.sin(t * 0.9) * 0.025 +
        (currentMood === 'listening' ? 0.03 + Math.sin(t * 2.8) * 0.035 * (0.3 + smoothStudentLevel) : 0);
      const yaw =
        rig.baseHeadRot.y +
        Math.sin(t * 0.55) * 0.04 +
        pointerNdcX * 0.06 +
        (currentMood === 'speaking' ? Math.sin(t * 1.8) * 0.05 : 0);
      rig.headBone.rotation.x = THREE.MathUtils.damp(rig.headBone.rotation.x, pitch, 6, dt);
      rig.headBone.rotation.y = THREE.MathUtils.damp(rig.headBone.rotation.y, yaw, 5, dt);
    }

    // Drive Ready Player Me / ARKit / Live3D morph targets if present
    const blinkWeight = Math.sin(blinkAmount * Math.PI);
    setGlbMorph(rig, ['jawOpen', 'viseme_aa', 'mouthOpen', 'MouthOpen', 'A', 'aa'], vocalOpen * 0.85);
    setGlbMorph(rig, ['viseme_O', 'mouthFunnel', 'O', 'oh'], vocalOpen * 0.35 * Math.abs(Math.sin(t * 9.5)));
    setGlbMorph(rig, ['eyeBlinkLeft', 'eyesClosed', 'blink_L', 'Blink'], blinkWeight);
    setGlbMorph(rig, ['eyeBlinkRight', 'blink_R'], blinkWeight);
    const smile = currentMood === 'listening' ? 0.25 : 0.1;
    setGlbMorph(rig, ['mouthSmileLeft', 'mouthSmile', 'smile'], smile);
    setGlbMorph(rig, ['mouthSmileRight'], smile);
  }

  function startLoop(): void {
    if (!renderer || !scene || !camera) return;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void): void => {
      if (!renderer || !isMounted) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = (): void => {
        if (!isMounted) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = (): void => {
      if (!isMounted || !renderer || !scene || !camera) return;
      const rawDt = Math.min(0.06, clock.getDelta());

      if (!isPaused) {
        const dt = rawDt;
        elapsedAnimTime += dt;
        const t = elapsedAnimTime;

        smoothExaminerLevel = THREE.MathUtils.damp(smoothExaminerLevel, targetExaminerLevel, 16, dt);
        smoothStudentLevel = THREE.MathUtils.damp(smoothStudentLevel, targetStudentLevel, 10, dt);

        const vocalOpen = THREE.MathUtils.clamp(
          smoothExaminerLevel * 2.5 +
            (currentMood === 'speaking' ? Math.abs(Math.sin(t * 13.5)) * 0.12 : 0),
          0,
          1
        );

        // Natural blinking timer
        blinkTimer -= dt;
        if (blinkTimer <= 0) {
          blinkAmount = 1;
          blinkTimer = 2.4 + Math.random() * 3.4;
        }
        blinkAmount = Math.max(0, blinkAmount - dt * 7.2);

        if (currentVrm) {
          animateVrmAvatar(currentVrm, dt, t, vocalOpen);
        } else if (currentGlbRig) {
          animateGlbAvatar(currentGlbRig, dt, t, vocalOpen);
        }

        // Desk status strip smooth color shift (no distracting pulse)
        if (micRingMat) {
          const targetCol =
            currentMood === 'speaking'
              ? _ringColorSpeaking
              : currentMood === 'listening'
                ? _ringColorListening
                : currentMood === 'thinking'
                  ? _ringColorThinking
                  : _ringColorIdle;
          _ringColor.copy(micRingMat.color).lerp(targetCol, Math.min(1, dt * 8));
          micRingMat.color.copy(_ringColor);
          micRingMat.emissive.copy(_ringColor);
          micRingMat.emissiveIntensity =
            currentMood === 'speaking'
              ? 0.85 + vocalOpen * 0.9
              : currentMood === 'listening'
                ? 0.75 + smoothStudentLevel * 1.1
                : 0.35;
        }

        // Smooth damped camera preset glide (yields immediately to manual OrbitControls)
        if (controls) {
          if (isCameraTransitioning) {
            const cfg = computeCameraPreset(currentPreset);
            _camTargetPos.set(...cfg.pos);
            _lookAtTarget.set(...cfg.target);
            camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 6, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 6, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 6, dt);
            controls.target.x = THREE.MathUtils.damp(controls.target.x, _lookAtTarget.x, 6, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, _lookAtTarget.y, 6, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, _lookAtTarget.z, 6, dt);
            if (
              camera.position.distanceTo(_camTargetPos) < 0.004 &&
              controls.target.distanceTo(_lookAtTarget) < 0.004
            ) {
              isCameraTransitioning = false;
            }
          }
          controls.update();
        }
      } else if (controls) {
        controls.update();
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    tick();
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!hostEl) return;
    const r = hostEl.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    pointerNdcX = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointerNdcY = THREE.MathUtils.clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
  }

  async function loadAvatarFromSavedSettings(): Promise<void> {
    const prefs = getExaminerSettings();
    currentPreset = prefs.cameraPreset;
    if (prefs.avatarPreset === 'custom') {
      const saved = await loadCustomAvatarFromDb();
      if (saved && saved.buffer && saved.buffer.byteLength > 0) {
        const blob = new Blob([saved.buffer], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        await loadAvatarInternal(blobUrl, saved.name, 'custom', true);
        return;
      }
      if (prefs.customAvatarUrl) {
        await loadAvatarInternal(
          prefs.customAvatarUrl,
          prefs.customAvatarName || 'Custom Avatar URL',
          'custom',
          false
        );
        return;
      }
    }
    const preset =
      BUILTIN_AVATARS.find((p) => p.id === prefs.avatarPreset) || BUILTIN_AVATARS[0];
    await loadAvatarInternal(preset.url, preset.name, preset.id, false);
  }

  async function initInitialAvatar(): Promise<void> {
    if (avatarInitialized && (currentVrm || currentGlbRig)) return;
    avatarInitialized = true;
    await loadAvatarFromSavedSettings();
  }

  return {
    mount(container: HTMLElement) {
      if (isMounted && hostEl === container) return;
      this.unmount();
      hostEl = container;
      isMounted = true;

      const rect = container.getBoundingClientRect();
      const width = Math.max(280, Math.floor(rect.width || 480));
      const height = Math.max(260, Math.floor(rect.height || 360));

      buildScene(width, height);
      if (renderer) {
        container.innerHTML = '';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.cursor = 'grab';
        container.appendChild(renderer.domElement);
      }

      container.addEventListener('pointermove', handlePointerMove, { passive: true });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const w = Math.max(200, Math.floor(entry.contentRect.width));
            const h = Math.max(180, Math.floor(entry.contentRect.height));
            if (camera && renderer) {
              camera.aspect = w / h;
              camera.updateProjectionMatrix();
              renderer.setSize(w, h);
            }
          }
        });
        resizeObserver.observe(container);
      }

      startLoop();
      void initInitialAvatar();
    },

    unmount() {
      isMounted = false;
      isPaused = false;
      avatarInitialized = false;
      avatarLoadToken++;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      frameId = 0;

      if (hostEl) {
        hostEl.removeEventListener('pointermove', handlePointerMove);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      disposeCurrentAvatar();

      if (controls) {
        controls.dispose();
        controls = null;
      }

      for (const item of sceneDisposables) {
        try {
          item.dispose();
        } catch {
          // ignore
        }
      }
      sceneDisposables.length = 0;

      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }

      scene = null;
      camera = null;
      hostEl = null;
      avatarRootGroup = null;
      lookAtTargetObj = null;
      micRingMat = null;
    },

    setAudioLevels(examinerLevel: number, studentLevel: number) {
      targetExaminerLevel = THREE.MathUtils.clamp(examinerLevel, 0, 1);
      targetStudentLevel = THREE.MathUtils.clamp(studentLevel, 0, 1);
    },

    setMood(mood: ExaminerMood) {
      currentMood = mood;
    },

    setCameraPreset(preset: ExaminerCameraPreset) {
      currentPreset = preset;
      isCameraTransitioning = true;
    },

    async loadPreset(presetId: BuiltInAvatarId) {
      const preset = BUILTIN_AVATARS.find((p) => p.id === presetId) || BUILTIN_AVATARS[0];
      await deleteCustomAvatarFromDb();
      await loadAvatarInternal(preset.url, preset.name, preset.id, false);
    },

    async loadAvatarFile(file: File) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.vrm') && !lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
        emitStatus({
          state: 'error',
          label: file.name,
          format: 'Loading',
          error: 'Unsupported file format. Please upload a .vrm (VRM 0.x / 1.0) or .glb (Live3D / Ready Player Me) avatar.',
          presetId: status.presetId,
        });
        return;
      }
      const buffer = await file.arrayBuffer();
      await saveCustomAvatarToDb(file.name, buffer);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      await loadAvatarInternal(blobUrl, file.name, 'custom', true);
    },

    async loadAvatarUrl(url: string, label?: string) {
      const clean = url.trim();
      if (!/^https?:\/\//i.test(clean) && !clean.startsWith('/')) {
        emitStatus({
          state: 'error',
          label: 'Remote Avatar',
          format: 'Loading',
          error: 'Please enter a valid https:// URL pointing directly to a .vrm or .glb model.',
          presetId: status.presetId,
        });
        return;
      }
      const inferredName = label || clean.split('/').pop()?.split('?')[0] || 'Custom VRM URL';
      await loadAvatarInternal(clean, inferredName, 'custom', false);
    },

    async clearCustomAvatar() {
      await deleteCustomAvatarFromDb();
      const preset = BUILTIN_AVATARS[0];
      await loadAvatarInternal(preset.url, preset.name, preset.id, false);
    },

    async applySavedSettings() {
      if (!isMounted) return;
      const prefs = getExaminerSettings();
      currentPreset = prefs.cameraPreset;
      isCameraTransitioning = true;
      await loadAvatarFromSavedSettings();
    },

    setPaused(paused: boolean) {
      isPaused = Boolean(paused);
    },

    getStatus() {
      return status;
    },

    onStatusChange(listener: (s: AvatarStatus) => void) {
      statusListeners.add(listener);
      listener(status);
      return () => {
        statusListeners.delete(listener);
      };
    },
  };
}
