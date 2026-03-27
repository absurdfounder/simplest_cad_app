import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelFormat, ModelInfo, BoundingBoxDims } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function detectFormat(filename: string): ModelFormat | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'stl': return 'stl';
    case '3mf': return '3mf';
    case 'obj': return 'obj';
    case 'glb':
    case 'gltf': return 'glb';
    default: return null;
  }
}

export function computeBounds(geometry: THREE.BufferGeometry): BoundingBoxDims {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return {
    x: Math.round((box.max.x - box.min.x) * 100) / 100,
    y: Math.round((box.max.y - box.min.y) * 100) / 100,
    z: Math.round((box.max.z - box.min.z) * 100) / 100,
  };
}

export function geometryInfo(geometry: THREE.BufferGeometry): { vertexCount: number; faceCount: number } {
  const pos = geometry.getAttribute('position');
  const vertexCount = pos ? pos.count : 0;
  const idx = geometry.getIndex();
  const faceCount = idx ? idx.count / 3 : vertexCount / 3;
  return { vertexCount, faceCount: Math.floor(faceCount) };
}

export async function loadModel(
  file: File
): Promise<{ geometry: THREE.BufferGeometry; scene: THREE.Group; info: ModelInfo }> {
  const format = detectFormat(file.name);
  if (!format) throw new Error(`Unsupported format: ${file.name}`);

  const arrayBuffer = await file.arrayBuffer();

  let geometry: THREE.BufferGeometry;
  let scene: THREE.Group;

  switch (format) {
    case 'stl': {
      const loader = new STLLoader();
      geometry = loader.parse(arrayBuffer);
      geometry.computeVertexNormals();
      scene = new THREE.Group();
      const mesh = new THREE.Mesh(geometry);
      scene.add(mesh);
      break;
    }
    case 'obj': {
      const loader = new OBJLoader();
      const text = new TextDecoder().decode(arrayBuffer);
      const obj = loader.parse(text);
      scene = obj;
      geometry = new THREE.BufferGeometry();
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          geometry = child.geometry as THREE.BufferGeometry;
        }
      });
      break;
    }
    case 'glb': {
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.parse(arrayBuffer, '', resolve, reject);
      });
      scene = gltf.scene;
      geometry = new THREE.BufferGeometry();
      scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          geometry = child.geometry as THREE.BufferGeometry;
        }
      });
      break;
    }
    case '3mf': {
      // 3MF basic support - treat as a group with basic geometry
      // Full 3MF parsing would need a dedicated library
      throw new Error('3MF import requires the 3MF loader addon. Please convert to STL or GLB.');
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  // Center geometry
  const center = new THREE.Vector3();
  geometry.boundingBox!.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  const bounds = computeBounds(geometry);
  const { vertexCount, faceCount } = geometryInfo(geometry);

  const info: ModelInfo = {
    id: uuidv4(),
    name: file.name.replace(/\.[^.]+$/, ''),
    format,
    mode: 'view_only',
    bounds,
    vertexCount,
    faceCount,
    fileSize: file.size,
  };

  return { geometry, scene, info };
}

export function exportSTL(geometry: THREE.BufferGeometry, filename: string): void {
  const positions = geometry.getAttribute('position');
  if (!positions) return;

  const normals = geometry.getAttribute('normal');
  const indices = geometry.getIndex();
  const numTriangles = indices ? indices.count / 3 : positions.count / 3;

  // Binary STL
  const headerBytes = 80;
  const triangleBytes = 50; // 12 normal + 36 vertices + 2 attribute
  const bufferSize = headerBytes + 4 + numTriangles * triangleBytes;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Header (80 bytes, can be anything)
  const header = 'Exported from CAD Chat App';
  for (let i = 0; i < Math.min(header.length, 80); i++) {
    view.setUint8(i, header.charCodeAt(i));
  }

  // Number of triangles
  view.setUint32(80, numTriangles, true);

  let offset = 84;
  for (let i = 0; i < numTriangles; i++) {
    let i0: number, i1: number, i2: number;
    if (indices) {
      i0 = indices.getX(i * 3);
      i1 = indices.getX(i * 3 + 1);
      i2 = indices.getX(i * 3 + 2);
    } else {
      i0 = i * 3;
      i1 = i * 3 + 1;
      i2 = i * 3 + 2;
    }

    // Normal
    if (normals) {
      view.setFloat32(offset, normals.getX(i0), true); offset += 4;
      view.setFloat32(offset, normals.getY(i0), true); offset += 4;
      view.setFloat32(offset, normals.getZ(i0), true); offset += 4;
    } else {
      offset += 12;
    }

    // Vertices
    view.setFloat32(offset, positions.getX(i0), true); offset += 4;
    view.setFloat32(offset, positions.getY(i0), true); offset += 4;
    view.setFloat32(offset, positions.getZ(i0), true); offset += 4;

    view.setFloat32(offset, positions.getX(i1), true); offset += 4;
    view.setFloat32(offset, positions.getY(i1), true); offset += 4;
    view.setFloat32(offset, positions.getZ(i1), true); offset += 4;

    view.setFloat32(offset, positions.getX(i2), true); offset += 4;
    view.setFloat32(offset, positions.getY(i2), true); offset += 4;
    view.setFloat32(offset, positions.getZ(i2), true); offset += 4;

    // Attribute byte count
    view.setUint16(offset, 0, true); offset += 2;
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.stl') ? filename : `${filename}.stl`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportOBJ(geometry: THREE.BufferGeometry, filename: string): void {
  const positions = geometry.getAttribute('position');
  if (!positions) return;

  const normals = geometry.getAttribute('normal');
  const indices = geometry.getIndex();
  let obj = '# Exported from CAD Chat App\n';

  for (let i = 0; i < positions.count; i++) {
    obj += `v ${positions.getX(i)} ${positions.getY(i)} ${positions.getZ(i)}\n`;
  }

  if (normals) {
    for (let i = 0; i < normals.count; i++) {
      obj += `vn ${normals.getX(i)} ${normals.getY(i)} ${normals.getZ(i)}\n`;
    }
  }

  const numFaces = indices ? indices.count / 3 : positions.count / 3;
  for (let i = 0; i < numFaces; i++) {
    let a: number, b: number, c: number;
    if (indices) {
      a = indices.getX(i * 3) + 1;
      b = indices.getX(i * 3 + 1) + 1;
      c = indices.getX(i * 3 + 2) + 1;
    } else {
      a = i * 3 + 1;
      b = i * 3 + 2;
      c = i * 3 + 3;
    }
    if (normals) {
      obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
    } else {
      obj += `f ${a} ${b} ${c}\n`;
    }
  }

  const blob = new Blob([obj], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.obj') ? filename : `${filename}.obj`;
  a.click();
  URL.revokeObjectURL(url);
}
