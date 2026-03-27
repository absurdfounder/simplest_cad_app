import { create } from 'zustand';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import type {
  ModelInfo,
  ModelMode,
  ParamSchema,
  ParamDef,
  Measurement,
  MeasurementType,
  Selection,
  ChatMessage,
  ChatRole,
  StructuredAction,
  Revision,
  ViewPreset,
  MeasureToolMode,
  ModelContext,
} from '@/types';

interface AppState {
  // Model
  modelInfo: ModelInfo | null;
  geometry: THREE.BufferGeometry | null;
  scene: THREE.Group | null;

  // Parameters
  paramSchema: ParamSchema | null;
  paramValues: Record<string, number | string | boolean>;

  // Selection
  selection: Selection | null;
  measurePoints: THREE.Vector3[];

  // Measurements
  measurements: Measurement[];
  measureTool: MeasureToolMode;

  // Chat
  messages: ChatMessage[];
  apiKey: string;
  chatLoading: boolean;

  // View
  viewPreset: ViewPreset;
  showWireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  clipPlane: boolean;
  clipPosition: number;

  // Revisions
  revisions: Revision[];
  currentRevisionId: string | null;

  // UI
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomTrayOpen: boolean;
  rightPanelTab: 'selection' | 'measures' | 'parameters' | 'model' | 'history';
  bottomTrayTab: 'versions' | 'export' | 'console';
  consoleMessages: string[];

  // Actions
  setModelInfo: (info: ModelInfo | null) => void;
  setGeometry: (geo: THREE.BufferGeometry | null) => void;
  setScene: (scene: THREE.Group | null) => void;
  setParamSchema: (schema: ParamSchema | null) => void;
  setParamValue: (key: string, value: number | string | boolean) => void;
  setParamValues: (values: Record<string, number | string | boolean>) => void;
  setSelection: (sel: Selection | null) => void;
  addMeasurePoint: (point: THREE.Vector3) => void;
  clearMeasurePoints: () => void;
  addMeasurement: (type: MeasurementType, label: string, value: number, unit: string, points: THREE.Vector3[]) => void;
  removeMeasurement: (id: string) => void;
  setMeasureTool: (tool: MeasureToolMode) => void;
  addMessage: (role: ChatRole, content: string, action?: StructuredAction) => void;
  setApiKey: (key: string) => void;
  setChatLoading: (loading: boolean) => void;
  setViewPreset: (preset: ViewPreset) => void;
  toggleWireframe: () => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleClipPlane: () => void;
  setClipPosition: (pos: number) => void;
  addRevision: (notes: string) => void;
  restoreRevision: (id: string) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomTray: () => void;
  setRightPanelTab: (tab: AppState['rightPanelTab']) => void;
  setBottomTrayTab: (tab: AppState['bottomTrayTab']) => void;
  addConsoleMessage: (msg: string) => void;
  getModelContext: () => ModelContext | null;
  applyAction: (action: StructuredAction) => void;
  markMessageApplied: (id: string) => void;
  loadDemoModel: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  modelInfo: null,
  geometry: null,
  scene: null,
  paramSchema: null,
  paramValues: {},
  selection: null,
  measurePoints: [],
  measurements: [],
  measureTool: 'none',
  messages: [],
  apiKey: '',
  chatLoading: false,
  viewPreset: 'perspective',
  showWireframe: false,
  showGrid: true,
  showAxes: true,
  clipPlane: false,
  clipPosition: 0,
  revisions: [],
  currentRevisionId: null,
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomTrayOpen: false,
  rightPanelTab: 'model',
  bottomTrayTab: 'versions',
  consoleMessages: [],

  // Actions
  setModelInfo: (info) => set({ modelInfo: info }),
  setGeometry: (geo) => set({ geometry: geo }),
  setScene: (scene) => set({ scene }),

  setParamSchema: (schema) => {
    if (schema) {
      const values: Record<string, number | string | boolean> = {};
      for (const [key, def] of Object.entries(schema.parameters)) {
        values[key] = def.value;
      }
      set({ paramSchema: schema, paramValues: values });
    } else {
      set({ paramSchema: schema });
    }
  },

  setParamValue: (key, value) =>
    set((state) => ({
      paramValues: { ...state.paramValues, [key]: value },
    })),

  setParamValues: (values) =>
    set((state) => ({
      paramValues: { ...state.paramValues, ...values },
    })),

  setSelection: (sel) => set({ selection: sel }),

  addMeasurePoint: (point) =>
    set((state) => ({
      measurePoints: [...state.measurePoints, point],
    })),

  clearMeasurePoints: () => set({ measurePoints: [] }),

  addMeasurement: (type, label, value, unit, points) =>
    set((state) => ({
      measurements: [
        ...state.measurements,
        { id: uuidv4(), type, label, value, unit, points, createdAt: Date.now() },
      ],
    })),

  removeMeasurement: (id) =>
    set((state) => ({
      measurements: state.measurements.filter((m) => m.id !== id),
    })),

  setMeasureTool: (tool) => set({ measureTool: tool, measurePoints: [] }),

  addMessage: (role, content, action) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: uuidv4(), role, content, timestamp: Date.now(), action, applied: false },
      ],
    })),

  setApiKey: (key) => set({ apiKey: key }),
  setChatLoading: (loading) => set({ chatLoading: loading }),

  setViewPreset: (preset) => set({ viewPreset: preset }),
  toggleWireframe: () => set((s) => ({ showWireframe: !s.showWireframe })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleClipPlane: () => set((s) => ({ clipPlane: !s.clipPlane })),
  setClipPosition: (pos) => set({ clipPosition: pos }),

  addRevision: (notes) => {
    const state = get();
    const rev: Revision = {
      id: uuidv4(),
      parentId: state.currentRevisionId,
      timestamp: Date.now(),
      notes,
      paramValues: { ...state.paramValues },
    };
    set((s) => ({
      revisions: [...s.revisions, rev],
      currentRevisionId: rev.id,
    }));
    get().addConsoleMessage(`Revision saved: ${notes}`);
  },

  restoreRevision: (id) => {
    const state = get();
    const rev = state.revisions.find((r) => r.id === id);
    if (rev) {
      set({ paramValues: { ...rev.paramValues }, currentRevisionId: id });
      get().addConsoleMessage(`Restored revision: ${rev.notes}`);
    }
  },

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleBottomTray: () => set((s) => ({ bottomTrayOpen: !s.bottomTrayOpen })),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setBottomTrayTab: (tab) => set({ bottomTrayTab: tab }),
  addConsoleMessage: (msg) =>
    set((s) => ({
      consoleMessages: [...s.consoleMessages, `[${new Date().toLocaleTimeString()}] ${msg}`],
    })),

  getModelContext: () => {
    const s = get();
    if (!s.modelInfo) return null;
    return {
      model: {
        type: s.modelInfo.mode,
        name: s.modelInfo.name,
        bounds_mm: s.modelInfo.bounds,
        format: s.modelInfo.format,
        vertex_count: s.modelInfo.vertexCount,
        face_count: s.modelInfo.faceCount,
      },
      selection: s.selection
        ? {
            entity: `face_${s.selection.faceIndex ?? 'unknown'}`,
            kind: s.selection.kind,
            point: s.selection.point ? [s.selection.point.x, s.selection.point.y, s.selection.point.z] : undefined,
            normal: s.selection.normal ? [s.selection.normal.x, s.selection.normal.y, s.selection.normal.z] : undefined,
          }
        : null,
      measurements: s.measurements.map((m) => ({
        label: m.label,
        value: Math.round(m.value * 100) / 100,
        unit: m.unit,
      })),
      parameters: s.paramValues,
      recent_changes: s.revisions.slice(-5).map((r) => r.notes),
    };
  },

  applyAction: (action) => {
    const state = get();
    if (action.action === 'update_parameters' && action.changes) {
      const newValues = { ...state.paramValues, ...action.changes };
      set({ paramValues: newValues });
      state.addRevision(`Applied: ${action.description || JSON.stringify(action.changes)}`);
      state.addConsoleMessage(`Parameters updated: ${JSON.stringify(action.changes)}`);
    }
  },

  markMessageApplied: (id) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, applied: true } : m)),
    })),

  loadDemoModel: () => {
    const schema: ParamSchema = {
      part: 'phone_support',
      parameters: {
        slot_width_mm: { type: 'number', value: 10, min: 8, max: 20, step: 0.1, unit: 'mm' },
        wall_height_mm: { type: 'number', value: 35, min: 20, max: 80, step: 0.5, unit: 'mm' },
        rail_length_mm: { type: 'number', value: 180, min: 80, max: 260, step: 1, unit: 'mm' },
        base_thickness_mm: { type: 'number', value: 4, min: 2, max: 10, step: 0.5, unit: 'mm' },
        support_angle_deg: { type: 'number', value: 75, min: 45, max: 90, step: 1, unit: 'deg' },
        fillet_radius_mm: { type: 'number', value: 2, min: 0, max: 5, step: 0.5, unit: 'mm' },
        style: { type: 'enum', value: 'minimal', options: ['minimal', 'rounded', 'industrial'] },
        add_cable_slot: { type: 'boolean', value: true },
      },
    };
    set({
      paramSchema: schema,
      paramValues: Object.fromEntries(
        Object.entries(schema.parameters).map(([k, v]) => [k, v.value])
      ),
      modelInfo: {
        id: uuidv4(),
        name: 'phone_support',
        format: 'parametric',
        mode: 'parametric',
        bounds: { x: 32, y: 180, z: 48 },
        vertexCount: 0,
        faceCount: 0,
        fileSize: 0,
      },
    });
    get().addConsoleMessage('Demo parametric model loaded: phone_support');
    get().addMessage('system', 'Parametric demo model "phone_support" loaded. You can edit parameters via chat or the right panel.');
  },
}));
