import * as THREE from 'three';

// ---- Model types ----
export type ModelFormat = 'stl' | '3mf' | 'obj' | 'glb' | 'parametric';
export type ModelMode = 'view_only' | 'parametric';

export interface BoundingBoxDims {
  x: number;
  y: number;
  z: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  format: ModelFormat;
  mode: ModelMode;
  bounds: BoundingBoxDims;
  vertexCount: number;
  faceCount: number;
  fileSize: number;
}

// ---- Parameters ----
export type ParamType = 'number' | 'enum' | 'boolean';

export interface NumberParam {
  type: 'number';
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export interface EnumParam {
  type: 'enum';
  value: string;
  options: string[];
}

export interface BooleanParam {
  type: 'boolean';
  value: boolean;
}

export type ParamDef = NumberParam | EnumParam | BooleanParam;

export interface ParamSchema {
  part: string;
  parameters: Record<string, ParamDef>;
}

// ---- Measurements ----
export type MeasurementType = 'point_to_point' | 'edge_length' | 'bounding_box' | 'angle' | 'wall_thickness';

export interface Measurement {
  id: string;
  type: MeasurementType;
  label: string;
  value: number;
  unit: string;
  points: THREE.Vector3[];
  createdAt: number;
}

// ---- Selection ----
export type SelectionKind = 'face' | 'edge' | 'vertex' | 'body';

export interface Selection {
  kind: SelectionKind;
  faceIndex?: number;
  point: THREE.Vector3;
  normal?: THREE.Vector3;
}

// ---- Chat ----
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  action?: StructuredAction;
  applied?: boolean;
}

export interface StructuredAction {
  action: 'update_parameters' | 'measure' | 'export' | 'view_change' | 'info';
  target?: string;
  changes?: Record<string, number | string | boolean>;
  description?: string;
}

// ---- Revisions ----
export interface Revision {
  id: string;
  parentId: string | null;
  timestamp: number;
  notes: string;
  paramValues: Record<string, number | string | boolean>;
  modelData?: ArrayBuffer;
}

// ---- View ----
export type ViewPreset = 'perspective' | 'top' | 'front' | 'right' | 'left' | 'back' | 'bottom';

export type MeasureToolMode = 'none' | 'point_to_point' | 'angle' | 'thickness';

// ---- AI Context ----
export interface ModelContext {
  model: {
    type: string;
    name: string;
    bounds_mm: BoundingBoxDims;
    format: string;
    vertex_count: number;
    face_count: number;
  };
  selection: {
    entity: string;
    kind: string;
    point?: number[];
    normal?: number[];
  } | null;
  measurements: Array<{
    label: string;
    value: number;
    unit: string;
  }>;
  parameters: Record<string, number | string | boolean>;
  recent_changes: string[];
}
