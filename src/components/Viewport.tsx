'use client';

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
  ContactShadows,
  Html,
} from '@react-three/drei';
import { useAppStore } from '@/store/useAppStore';
import { generateParametricGeometry } from '@/lib/parametricEngine';
import type { ViewPreset, MeasureToolMode } from '@/types';

// ---------------------------------------------------------------------------
// Camera preset positions
// ---------------------------------------------------------------------------

const CAMERA_PRESETS: Record<ViewPreset, { position: THREE.Vector3; up: THREE.Vector3 }> = {
  perspective: { position: new THREE.Vector3(120, 100, 120), up: new THREE.Vector3(0, 1, 0) },
  top:         { position: new THREE.Vector3(0, 200, 0),     up: new THREE.Vector3(0, 0, -1) },
  bottom:      { position: new THREE.Vector3(0, -200, 0),    up: new THREE.Vector3(0, 0, 1) },
  front:       { position: new THREE.Vector3(0, 0, 200),     up: new THREE.Vector3(0, 1, 0) },
  back:        { position: new THREE.Vector3(0, 0, -200),    up: new THREE.Vector3(0, 1, 0) },
  right:       { position: new THREE.Vector3(200, 0, 0),     up: new THREE.Vector3(0, 1, 0) },
  left:        { position: new THREE.Vector3(-200, 0, 0),    up: new THREE.Vector3(0, 1, 0) },
};

// ---------------------------------------------------------------------------
// Camera animator – smoothly lerps camera to preset
// ---------------------------------------------------------------------------

function CameraAnimator() {
  const { camera } = useThree();
  const viewPreset = useAppStore((s) => s.viewPreset);
  const targetRef = useRef<{ pos: THREE.Vector3; up: THREE.Vector3; active: boolean }>({
    pos: CAMERA_PRESETS.perspective.position.clone(),
    up: CAMERA_PRESETS.perspective.up.clone(),
    active: false,
  });

  useEffect(() => {
    const preset = CAMERA_PRESETS[viewPreset];
    if (!preset) return;
    targetRef.current.pos.copy(preset.position);
    targetRef.current.up.copy(preset.up);
    targetRef.current.active = true;
  }, [viewPreset]);

  useFrame(() => {
    if (!targetRef.current.active) return;
    camera.position.lerp(targetRef.current.pos, 0.08);
    camera.up.lerp(targetRef.current.up, 0.08);
    camera.lookAt(0, 0, 0);

    if (camera.position.distanceTo(targetRef.current.pos) < 0.5) {
      camera.position.copy(targetRef.current.pos);
      camera.up.copy(targetRef.current.up);
      camera.lookAt(0, 0, 0);
      targetRef.current.active = false;
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Measurement visualisation helpers
// ---------------------------------------------------------------------------

function MeasurePointMarkers() {
  const measurePoints = useAppStore((s) => s.measurePoints);
  return (
    <>
      {measurePoints.map((pt, i) => (
        <mesh key={i} position={[pt.x, pt.y, pt.z]}>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </>
  );
}

function MeasurementOverlays() {
  const measurements = useAppStore((s) => s.measurements);

  return (
    <>
      {measurements.map((m) => {
        const pts = m.points;
        if (pts.length < 2) return null;

        // Build line positions for all consecutive point pairs
        const linePositions: number[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
          linePositions.push(pts[i].x, pts[i].y, pts[i].z);
          linePositions.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        }

        // Label at midpoint of first segment
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const midZ = (pts[0].z + pts[1].z) / 2;

        const displayValue = Math.round(m.value * 100) / 100;

        return (
          <group key={m.id}>
            {/* Measurement line */}
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array(linePositions), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ffcc00" linewidth={2} />
            </lineSegments>

            {/* Endpoint markers */}
            {pts.map((pt, idx) => (
              <mesh key={idx} position={[pt.x, pt.y, pt.z]}>
                <sphereGeometry args={[0.8, 12, 12]} />
                <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={0.4} />
              </mesh>
            ))}

            {/* Label */}
            <Html position={[midX, midY + 4, midZ]} center distanceFactor={200}>
              <div
                style={{
                  background: 'rgba(0,0,0,0.8)',
                  color: '#ffcc00',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  border: '1px solid rgba(255,204,0,0.4)',
                }}
              >
                {m.label}: {displayValue} {m.unit}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main model mesh
// ---------------------------------------------------------------------------

interface ModelMeshProps {
  geometry: THREE.BufferGeometry;
  showWireframe: boolean;
  clipPlane: boolean;
  clipPosition: number;
}

function ModelMesh({ geometry, showWireframe, clipPlane, clipPosition }: ModelMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);

  const setSelection = useAppStore((s) => s.setSelection);
  const measureTool = useAppStore((s) => s.measureTool);
  const addMeasurePoint = useAppStore((s) => s.addMeasurePoint);
  const measurePoints = useAppStore((s) => s.measurePoints);
  const clearMeasurePoints = useAppStore((s) => s.clearMeasurePoints);
  const addMeasurement = useAppStore((s) => s.addMeasurement);
  const addConsoleMessage = useAppStore((s) => s.addConsoleMessage);

  // Clipping plane
  const clippingPlane = useMemo(() => {
    return new THREE.Plane(new THREE.Vector3(-1, 0, 0), clipPosition);
  }, [clipPosition]);

  const mainMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#6899cc',
      metalness: 0.35,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    if (clipPlane) {
      mat.clippingPlanes = [clippingPlane];
      mat.clipShadows = true;
    }
    return mat;
  }, [clipPlane, clippingPlane]);

  const wireMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      wireframe: true,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    if (clipPlane) {
      mat.clippingPlanes = [clippingPlane];
    }
    return mat;
  }, [clipPlane, clippingPlane]);

  // Handle mesh clicks
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const intersection = event.intersections[0];
      if (!intersection) return;

      const point = intersection.point.clone();
      const faceNormal = intersection.face?.normal?.clone() ?? new THREE.Vector3(0, 1, 0);
      const faceIndex = intersection.faceIndex ?? undefined;

      // If a measure tool is active, handle measurement
      if (measureTool === 'point_to_point') {
        addMeasurePoint(point);
        const currentPoints = [...measurePoints, point];

        if (currentPoints.length >= 2) {
          const p1 = currentPoints[0];
          const p2 = currentPoints[1];
          const distance = p1.distanceTo(p2);
          addMeasurement('point_to_point', `Distance`, distance, 'mm', [p1, p2]);
          clearMeasurePoints();
          addConsoleMessage(`Measured distance: ${Math.round(distance * 100) / 100} mm`);
        }
        return;
      }

      if (measureTool === 'angle') {
        addMeasurePoint(point);
        const currentPoints = [...measurePoints, point];

        if (currentPoints.length >= 3) {
          const p1 = currentPoints[0];
          const p2 = currentPoints[1]; // vertex of the angle
          const p3 = currentPoints[2];

          const v1 = new THREE.Vector3().subVectors(p1, p2).normalize();
          const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
          const angleRad = Math.acos(THREE.MathUtils.clamp(v1.dot(v2), -1, 1));
          const angleDeg = THREE.MathUtils.radToDeg(angleRad);

          addMeasurement('angle', `Angle`, angleDeg, 'deg', [p1, p2, p3]);
          clearMeasurePoints();
          addConsoleMessage(`Measured angle: ${Math.round(angleDeg * 100) / 100} deg`);
        }
        return;
      }

      // Normal selection
      setSelection({
        kind: 'face',
        faceIndex,
        point,
        normal: faceNormal,
      });
    },
    [
      measureTool,
      measurePoints,
      setSelection,
      addMeasurePoint,
      clearMeasurePoints,
      addMeasurement,
      addConsoleMessage,
    ]
  );

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={mainMaterial}
        castShadow
        receiveShadow
        onClick={handleClick}
      />
      {showWireframe && (
        <mesh ref={wireRef} geometry={geometry} material={wireMaterial} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Scene loaded inside the Canvas
// ---------------------------------------------------------------------------

function ViewportScene() {
  const geometry = useAppStore((s) => s.geometry);
  const paramSchema = useAppStore((s) => s.paramSchema);
  const paramValues = useAppStore((s) => s.paramValues);
  const showWireframe = useAppStore((s) => s.showWireframe);
  const showGrid = useAppStore((s) => s.showGrid);
  const showAxes = useAppStore((s) => s.showAxes);
  const clipPlane = useAppStore((s) => s.clipPlane);
  const clipPosition = useAppStore((s) => s.clipPosition);
  const modelInfo = useAppStore((s) => s.modelInfo);

  const { gl } = useThree();

  // Enable clipping on the renderer
  useEffect(() => {
    gl.localClippingEnabled = clipPlane;
  }, [gl, clipPlane]);

  // Generate parametric geometry when paramValues change
  const parametricGeometry = useMemo(() => {
    if (!paramSchema || modelInfo?.mode !== 'parametric') return null;
    try {
      return generateParametricGeometry(paramSchema, paramValues);
    } catch (e) {
      console.error('Parametric geometry generation failed:', e);
      return null;
    }
  }, [paramSchema, paramValues, modelInfo?.mode]);

  // Determine which geometry to show
  const activeGeometry = parametricGeometry ?? geometry;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={500}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
      />
      <directionalLight position={[-40, 60, -30]} intensity={0.3} />
      <Environment preset="studio" background={false} />

      {/* Camera animation */}
      <CameraAnimator />

      {/* Controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={10}
        maxDistance={800}
      />

      {/* Grid */}
      {showGrid && (
        <Grid
          args={[400, 400]}
          position={[0, -0.01, 0]}
          cellSize={10}
          cellThickness={0.5}
          cellColor="#3a3a5a"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#5a5a8a"
          fadeDistance={500}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}

      {/* Axes */}
      {showAxes && <axesHelper args={[60]} />}

      {/* Gizmo */}
      <GizmoHelper alignment="top-right" margin={[80, 80]}>
        <GizmoViewport
          axisColors={['#e74c3c', '#2ecc71', '#3498db']}
          labelColor="white"
        />
      </GizmoHelper>

      {/* Contact shadows under model */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.35}
        scale={300}
        blur={2}
        far={100}
      />

      {/* Model */}
      {activeGeometry && (
        <ModelMesh
          geometry={activeGeometry}
          showWireframe={showWireframe}
          clipPlane={clipPlane}
          clipPosition={clipPosition}
        />
      )}

      {/* Measurement overlays */}
      <MeasurePointMarkers />
      <MeasurementOverlays />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper component
// ---------------------------------------------------------------------------

function WebGLFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#eaeaea',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e94560" strokeWidth="1.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
      </svg>
      <h2 style={{ margin: '1rem 0 0.5rem', fontSize: '1.25rem' }}>WebGL Not Available</h2>
      <p style={{ color: '#8892b0', maxWidth: '400px', lineHeight: 1.5 }}>
        Your browser or environment does not support WebGL, which is required for the 3D viewport.
        Try opening this app in a browser with GPU acceleration enabled (Chrome, Firefox, Edge).
      </p>
    </div>
  );
}

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export default function Viewport() {
  const [webglOk, setWebglOk] = React.useState(true);

  React.useEffect(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  if (!webglOk) return <WebGLFallback />;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{
          position: [120, 100, 120],
          fov: 45,
          near: 0.1,
          far: 2000,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          localClippingEnabled: true,
        }}
        style={{ background: '#1a1a2e' }}
        onPointerMissed={() => {
          useAppStore.getState().setSelection(null);
        }}
      >
        <ViewportScene />
      </Canvas>
    </div>
  );
}
