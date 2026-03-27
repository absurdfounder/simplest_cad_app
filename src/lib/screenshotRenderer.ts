import * as THREE from 'three';
import { generateParametricGeometry } from './parametricEngine';
import type { ParamSchema, ViewPreset } from '@/types';

/**
 * Offscreen renderer that captures screenshots of the 3D model from multiple angles.
 * Returns base64 PNG images that can be passed to AI agents for visual inspection.
 */

const ANGLE_PRESETS: Record<string, { position: [number, number, number]; up: [number, number, number]; label: string }> = {
  perspective: { position: [120, 100, 120], up: [0, 1, 0], label: 'Perspective (3/4 view)' },
  front: { position: [0, 0, 200], up: [0, 1, 0], label: 'Front view' },
  back: { position: [0, 0, -200], up: [0, 1, 0], label: 'Back view' },
  right: { position: [200, 0, 0], up: [0, 1, 0], label: 'Right view' },
  left: { position: [-200, 0, 0], up: [0, 1, 0], label: 'Left view' },
  top: { position: [0, 200, 0], up: [0, 0, -1], label: 'Top view' },
  bottom: { position: [0, -200, 0], up: [0, 0, 1], label: 'Bottom view' },
  iso_front_right: { position: [150, 120, 150], up: [0, 1, 0], label: 'Isometric front-right' },
  iso_front_left: { position: [-150, 120, 150], up: [0, 1, 0], label: 'Isometric front-left' },
  iso_back_right: { position: [150, 120, -150], up: [0, 1, 0], label: 'Isometric back-right' },
};

export interface ScreenshotResult {
  angle: string;
  label: string;
  dataUrl: string; // base64 PNG data URL
  width: number;
  height: number;
}

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  angles?: string[];
  background?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  modelColor?: string;
}

const DEFAULT_OPTIONS: Required<ScreenshotOptions> = {
  width: 800,
  height: 600,
  angles: ['perspective', 'front', 'right', 'top'],
  background: '#1a1a2e',
  showGrid: true,
  showAxes: true,
  modelColor: '#6899cc',
};

/**
 * Render screenshots of a geometry from multiple angles.
 */
export function captureScreenshots(
  geometry: THREE.BufferGeometry,
  options: ScreenshotOptions = {}
): ScreenshotResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: ScreenshotResult[] = [];

  // Create offscreen renderer
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setSize(opts.width, opts.height);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(100, 150, 100);
  dirLight1.castShadow = true;
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight2.position.set(-80, 100, -60);
  scene.add(dirLight2);

  // Add hemisphere light for better ambient
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
  scene.add(hemiLight);

  // Model
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(opts.modelColor),
    metalness: 0.35,
    roughness: 0.45,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Grid
  if (opts.showGrid) {
    const gridHelper = new THREE.GridHelper(400, 40, 0x2a2a4a, 0x1a1a3e);
    scene.add(gridHelper);
  }

  // Axes
  if (opts.showAxes) {
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);
  }

  // Ground plane for shadow
  const groundGeo = new THREE.PlaneGeometry(500, 500);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  // Compute bounding sphere for camera framing
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!;
  const center = sphere.center.clone();
  const radius = sphere.radius || 50;

  // Camera
  const camera = new THREE.PerspectiveCamera(45, opts.width / opts.height, 0.1, 2000);

  // Render each angle
  for (const angleName of opts.angles) {
    const preset = ANGLE_PRESETS[angleName];
    if (!preset) continue;

    // Position camera relative to model bounds
    const distance = radius * 3;
    const dir = new THREE.Vector3(...preset.position).normalize();
    camera.position.copy(dir.multiplyScalar(distance).add(center));
    camera.up.set(...preset.up);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    const dataUrl = canvas.toDataURL('image/png');
    results.push({
      angle: angleName,
      label: preset.label,
      dataUrl,
      width: opts.width,
      height: opts.height,
    });
  }

  // Cleanup
  renderer.dispose();
  material.dispose();
  groundGeo.dispose();
  groundMat.dispose();

  return results;
}

/**
 * Capture screenshots of a parametric model from its schema and params.
 */
export function captureParametricScreenshots(
  schema: ParamSchema,
  values: Record<string, number | string | boolean>,
  options: ScreenshotOptions = {}
): ScreenshotResult[] {
  const geometry = generateParametricGeometry(schema, values);
  const results = captureScreenshots(geometry, options);
  geometry.dispose();
  return results;
}

/**
 * Get all available angle preset names.
 */
export function getAvailableAngles(): Array<{ name: string; label: string }> {
  return Object.entries(ANGLE_PRESETS).map(([name, preset]) => ({
    name,
    label: preset.label,
  }));
}

/**
 * Convert screenshot results to a format suitable for AI context.
 * Returns an array of objects with angle info and base64 data.
 */
export function screenshotsToAIContext(screenshots: ScreenshotResult[]): Array<{
  angle: string;
  label: string;
  image_base64: string;
  dimensions: { width: number; height: number };
}> {
  return screenshots.map((s) => ({
    angle: s.angle,
    label: s.label,
    // Strip the data:image/png;base64, prefix for raw base64
    image_base64: s.dataUrl.replace(/^data:image\/png;base64,/, ''),
    dimensions: { width: s.width, height: s.height },
  }));
}

/**
 * Capture a single screenshot and return as Blob for download.
 */
export async function captureScreenshotBlob(
  geometry: THREE.BufferGeometry,
  angle: string = 'perspective',
  options: ScreenshotOptions = {}
): Promise<Blob | null> {
  const results = captureScreenshots(geometry, { ...options, angles: [angle] });
  if (results.length === 0) return null;

  const dataUrl = results[0].dataUrl;
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Download all angle screenshots as individual PNGs.
 */
export function downloadScreenshots(
  screenshots: ScreenshotResult[],
  prefix: string = 'model'
): void {
  for (const shot of screenshots) {
    const a = document.createElement('a');
    a.href = shot.dataUrl;
    a.download = `${prefix}_${shot.angle}.png`;
    a.click();
  }
}
