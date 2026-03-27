import * as THREE from 'three';
import type { ParamSchema } from '@/types';

/**
 * Parametric geometry generator.
 * Generates a phone support stand based on parameter values.
 * This is the app-native parametric engine for MVP.
 */
export function generateParametricGeometry(
  schema: ParamSchema,
  values: Record<string, number | string | boolean>
): THREE.BufferGeometry {
  const part = schema.part;

  switch (part) {
    case 'phone_support':
      return generatePhoneSupport(values);
    default:
      return generateGenericBox(values);
  }
}

function generatePhoneSupport(
  params: Record<string, number | string | boolean>
): THREE.BufferGeometry {
  const slotWidth = (params.slot_width_mm as number) || 10;
  const wallHeight = (params.wall_height_mm as number) || 35;
  const railLength = (params.rail_length_mm as number) || 180;
  const baseThickness = (params.base_thickness_mm as number) || 4;
  const supportAngle = ((params.support_angle_deg as number) || 75) * (Math.PI / 180);
  const filletRadius = (params.fillet_radius_mm as number) || 2;
  const style = (params.style as string) || 'minimal';
  const addCableSlot = params.add_cable_slot !== false;

  const group = new THREE.Group();

  // Base plate
  const baseWidth = slotWidth + 20;
  const baseGeo = new THREE.BoxGeometry(baseWidth, baseThickness, railLength);
  const baseMesh = new THREE.Mesh(baseGeo);
  baseMesh.position.y = baseThickness / 2;
  group.add(baseMesh);

  // Back support wall
  const wallThickness = style === 'industrial' ? 4 : style === 'rounded' ? 3 : 2.5;
  const wallGeo = new THREE.BoxGeometry(baseWidth, wallHeight, wallThickness);
  const wallMesh = new THREE.Mesh(wallGeo);
  wallMesh.position.y = baseThickness + wallHeight / 2;
  wallMesh.position.z = -railLength / 2 + wallThickness / 2;
  group.add(wallMesh);

  // Phone slot rails (left and right)
  const railHeight = wallHeight * 0.6;
  const railThickness = 2;

  // Left rail
  const leftRailGeo = new THREE.BoxGeometry(railThickness, railHeight, railLength * 0.7);
  const leftRail = new THREE.Mesh(leftRailGeo);
  leftRail.position.x = -slotWidth / 2 - railThickness / 2;
  leftRail.position.y = baseThickness + railHeight / 2;
  group.add(leftRail);

  // Right rail
  const rightRailGeo = new THREE.BoxGeometry(railThickness, railHeight, railLength * 0.7);
  const rightRail = new THREE.Mesh(rightRailGeo);
  rightRail.position.x = slotWidth / 2 + railThickness / 2;
  rightRail.position.y = baseThickness + railHeight / 2;
  group.add(rightRail);

  // Front lip
  const lipHeight = baseThickness * 2;
  const lipGeo = new THREE.BoxGeometry(baseWidth, lipHeight, wallThickness);
  const lipMesh = new THREE.Mesh(lipGeo);
  lipMesh.position.y = baseThickness + lipHeight / 2;
  lipMesh.position.z = railLength / 2 - wallThickness / 2;
  group.add(lipMesh);

  // Cable slot (cutout representation)
  if (addCableSlot) {
    const cableWidth = 12;
    const cableHeight = baseThickness;
    const cableGeo = new THREE.BoxGeometry(cableWidth, cableHeight * 0.5, wallThickness + 2);
    const cableMesh = new THREE.Mesh(cableGeo);
    cableMesh.position.y = baseThickness + lipHeight + cableHeight * 0.25;
    cableMesh.position.z = railLength / 2 - wallThickness / 2;
    group.add(cableMesh);
  }

  // Angled support (simplified as a tilted box)
  if (supportAngle < Math.PI / 2 - 0.01) {
    const supportLength = wallHeight * 0.8;
    const supportGeo = new THREE.BoxGeometry(baseWidth * 0.3, 2, supportLength);
    const supportMesh = new THREE.Mesh(supportGeo);
    supportMesh.position.y = baseThickness + wallHeight * 0.3;
    supportMesh.position.z = -railLength / 2 + wallThickness + supportLength * 0.3;
    supportMesh.rotation.x = Math.PI / 2 - supportAngle;
    group.add(supportMesh);
  }

  // Style-specific additions
  if (style === 'rounded' && filletRadius > 0) {
    // Add decorative cylinder at base corners
    const cornerGeo = new THREE.CylinderGeometry(filletRadius, filletRadius, baseThickness, 16);
    const positions = [
      [-baseWidth / 2, baseThickness / 2, -railLength / 2],
      [baseWidth / 2, baseThickness / 2, -railLength / 2],
      [-baseWidth / 2, baseThickness / 2, railLength / 2],
      [baseWidth / 2, baseThickness / 2, railLength / 2],
    ];
    for (const pos of positions) {
      const corner = new THREE.Mesh(cornerGeo);
      corner.position.set(pos[0], pos[1], pos[2]);
      group.add(corner);
    }
  }

  if (style === 'industrial') {
    // Add reinforcement ribs
    const ribCount = 3;
    for (let i = 0; i < ribCount; i++) {
      const ribGeo = new THREE.BoxGeometry(baseWidth, 1.5, 1.5);
      const rib = new THREE.Mesh(ribGeo);
      rib.position.y = baseThickness / 2;
      rib.position.z = -railLength / 3 + (i * railLength) / (ribCount + 1);
      group.add(rib);
    }
  }

  // Merge all geometries into one
  const mergedGeometry = mergeGroupGeometry(group);
  return mergedGeometry;
}

function generateGenericBox(
  params: Record<string, number | string | boolean>
): THREE.BufferGeometry {
  const width = (params.width_mm as number) || 50;
  const height = (params.height_mm as number) || 30;
  const depth = (params.depth_mm as number) || 50;
  return new THREE.BoxGeometry(width, height, depth);
}

function mergeGroupGeometry(group: THREE.Group): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry.clone();
      child.updateMatrixWorld(true);
      geo.applyMatrix4(child.matrixWorld);
      geometries.push(geo);
    }
  });

  if (geometries.length === 0) {
    return new THREE.BoxGeometry(10, 10, 10);
  }

  if (geometries.length === 1) {
    return geometries[0];
  }

  // Manual merge
  let totalVertices = 0;
  let totalIndices = 0;

  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    totalVertices += pos.count;
    const idx = geo.getIndex();
    if (idx) {
      totalIndices += idx.count;
    } else {
      totalIndices += pos.count;
    }
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geo of geometries) {
    geo.computeVertexNormals();
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const idx = geo.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i);
      if (norm) {
        normals[(vertexOffset + i) * 3] = norm.getX(i);
        normals[(vertexOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertexOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices[indexOffset + i] = idx.getX(i) + vertexOffset;
      }
      indexOffset += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[indexOffset + i] = vertexOffset + i;
      }
      indexOffset += pos.count;
    }

    vertexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  merged.computeBoundingBox();

  return merged;
}
