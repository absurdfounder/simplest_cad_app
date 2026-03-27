'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { MeasureToolMode, NumberParam, EnumParam, BooleanParam } from '@/types';

const tabs = ['Selection', 'Measures', 'Parameters', 'Model', 'History'] as const;
type TabName = (typeof tabs)[number];

const tabToStoreTab: Record<TabName, 'selection' | 'measures' | 'parameters' | 'model' | 'history'> = {
  Selection: 'selection',
  Measures: 'measures',
  Parameters: 'parameters',
  Model: 'model',
  History: 'history',
};

function formatCoord(v: { x: number; y: number; z: number }): string {
  return `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ---- Tab Content Components ----

function SelectionTab() {
  const selection = useAppStore((s) => s.selection);

  if (!selection) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-cad-muted">
        <svg className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p className="text-sm">No selection</p>
        <p className="text-xs mt-1 opacity-60">Click on the model to select a face, edge, or vertex</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-cad-accent/30 rounded-lg p-3 border border-cad-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-cad-highlight" />
          <span className="text-sm font-medium text-cad-text capitalize">{selection.kind}</span>
        </div>

        {selection.faceIndex !== undefined && (
          <div className="flex justify-between text-xs mb-1">
            <span className="text-cad-muted">Face Index</span>
            <span className="text-cad-text font-mono">{selection.faceIndex}</span>
          </div>
        )}

        <div className="flex justify-between text-xs mb-1">
          <span className="text-cad-muted">Point</span>
          <span className="text-cad-text font-mono text-[11px]">{formatCoord(selection.point)}</span>
        </div>

        {selection.normal && (
          <div className="flex justify-between text-xs">
            <span className="text-cad-muted">Normal</span>
            <span className="text-cad-text font-mono text-[11px]">{formatCoord(selection.normal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MeasuresTab() {
  const measurements = useAppStore((s) => s.measurements);
  const removeMeasurement = useAppStore((s) => s.removeMeasurement);
  const measureTool = useAppStore((s) => s.measureTool);
  const setMeasureTool = useAppStore((s) => s.setMeasureTool);

  const tools: { label: string; mode: MeasureToolMode }[] = [
    { label: 'Point-to-Point', mode: 'point_to_point' },
    { label: 'Angle', mode: 'angle' },
    { label: 'Thickness', mode: 'thickness' },
  ];

  return (
    <div className="space-y-4">
      {/* Tool buttons */}
      <div>
        <p className="text-xs text-cad-muted mb-2 uppercase tracking-wider">Measurement Tools</p>
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <button
              key={t.mode}
              onClick={() => setMeasureTool(measureTool === t.mode ? 'none' : t.mode)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                measureTool === t.mode
                  ? 'bg-cad-highlight text-white'
                  : 'bg-cad-accent/40 text-cad-muted hover:text-cad-text hover:bg-cad-accent/60'
              }`}
            >
              {t.label}
            </button>
          ))}
          {measureTool !== 'none' && (
            <button
              onClick={() => setMeasureTool('none')}
              className="px-3 py-1.5 rounded text-xs font-medium bg-cad-surface text-cad-muted hover:text-cad-highlight border border-cad-border transition-colors"
            >
              Clear tool
            </button>
          )}
        </div>
      </div>

      {/* Measurements list */}
      <div>
        <p className="text-xs text-cad-muted mb-2 uppercase tracking-wider">
          Saved Measurements ({measurements.length})
        </p>
        {measurements.length === 0 ? (
          <p className="text-xs text-cad-muted/60 italic">No measurements yet</p>
        ) : (
          <div className="space-y-1.5">
            {measurements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-cad-accent/20 rounded px-3 py-2 border border-cad-border group"
              >
                <div>
                  <p className="text-xs text-cad-text font-medium">{m.label}</p>
                  <p className="text-xs text-cad-muted font-mono">
                    {m.value.toFixed(2)} {m.unit}
                  </p>
                </div>
                <button
                  onClick={() => removeMeasurement(m.id)}
                  className="text-cad-muted hover:text-cad-highlight opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Delete measurement"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParametersTab() {
  const paramSchema = useAppStore((s) => s.paramSchema);
  const paramValues = useAppStore((s) => s.paramValues);
  const setParamValue = useAppStore((s) => s.setParamValue);
  const setParamValues = useAppStore((s) => s.setParamValues);
  const addRevision = useAppStore((s) => s.addRevision);
  const [revisionNote, setRevisionNote] = useState('');

  if (!paramSchema) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-cad-muted">
        <p className="text-sm">No parameters available</p>
        <p className="text-xs mt-1 opacity-60">Load a parametric model to edit parameters</p>
      </div>
    );
  }

  const presets = [
    { label: 'Tight Fit', slotWidth: 8.5 },
    { label: 'Normal Fit', slotWidth: 10.0 },
    { label: 'Loose Fit', slotWidth: 12.0 },
  ];

  return (
    <div className="space-y-4">
      {/* Parameter controls */}
      <div className="space-y-3">
        {Object.entries(paramSchema.parameters).map(([key, def]) => {
          const currentValue = paramValues[key] ?? def.value;

          if (def.type === 'number') {
            const numDef = def as NumberParam;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <label className="text-xs text-cad-muted">{key.replace(/_/g, ' ')}</label>
                  <span className="text-[10px] text-cad-muted/60">{numDef.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={numDef.min}
                    max={numDef.max}
                    step={numDef.step}
                    value={currentValue as number}
                    onChange={(e) => setParamValue(key, parseFloat(e.target.value))}
                    className="flex-1 h-1.5 accent-cad-highlight bg-cad-accent/40 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cad-highlight"
                  />
                  <input
                    type="number"
                    min={numDef.min}
                    max={numDef.max}
                    step={numDef.step}
                    value={currentValue as number}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setParamValue(key, Math.min(numDef.max, Math.max(numDef.min, v)));
                    }}
                    className="w-16 bg-cad-surface border border-cad-border rounded px-1.5 py-0.5 text-xs text-cad-text text-right font-mono focus:outline-none focus:border-cad-highlight"
                  />
                </div>
              </div>
            );
          }

          if (def.type === 'enum') {
            const enumDef = def as EnumParam;
            return (
              <div key={key} className="space-y-1">
                <label className="text-xs text-cad-muted">{key.replace(/_/g, ' ')}</label>
                <select
                  value={currentValue as string}
                  onChange={(e) => setParamValue(key, e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs text-cad-text focus:outline-none focus:border-cad-highlight cursor-pointer"
                >
                  {enumDef.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (def.type === 'boolean') {
            return (
              <div key={key} className="flex items-center justify-between py-1">
                <label className="text-xs text-cad-muted">{key.replace(/_/g, ' ')}</label>
                <button
                  onClick={() => setParamValue(key, !currentValue)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    currentValue ? 'bg-cad-highlight' : 'bg-cad-accent/60'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      currentValue ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Presets */}
      <div>
        <p className="text-xs text-cad-muted mb-2 uppercase tracking-wider">Presets</p>
        <div className="flex gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                if ('slot_width_mm' in paramValues) {
                  setParamValues({ slot_width_mm: p.slotWidth });
                }
              }}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-cad-accent/40 text-cad-muted hover:text-cad-text hover:bg-cad-accent/60 transition-colors border border-cad-border"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save Revision */}
      <div className="pt-2 border-t border-cad-border">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="Revision note..."
            className="flex-1 bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs text-cad-text placeholder:text-cad-muted/40 focus:outline-none focus:border-cad-highlight"
          />
          <button
            onClick={() => {
              addRevision(revisionNote || 'Manual save');
              setRevisionNote('');
            }}
            className="px-3 py-1.5 rounded text-xs font-medium bg-cad-success/20 text-cad-success hover:bg-cad-success/30 transition-colors border border-cad-success/30"
          >
            Save Revision
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelTab() {
  const modelInfo = useAppStore((s) => s.modelInfo);

  if (!modelInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-cad-muted">
        <svg className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-sm">No model loaded</p>
      </div>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: modelInfo.name },
    { label: 'Format', value: modelInfo.format.toUpperCase() },
    { label: 'Mode', value: modelInfo.mode.replace('_', ' ') },
    {
      label: 'Bounding Box',
      value: `${modelInfo.bounds.x.toFixed(1)} x ${modelInfo.bounds.y.toFixed(1)} x ${modelInfo.bounds.z.toFixed(1)} mm`,
    },
    { label: 'Vertices', value: modelInfo.vertexCount.toLocaleString() },
    { label: 'Faces', value: modelInfo.faceCount.toLocaleString() },
    { label: 'File Size', value: formatFileSize(modelInfo.fileSize) },
  ];

  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between py-1.5 border-b border-cad-border/40 last:border-0">
          <span className="text-xs text-cad-muted">{r.label}</span>
          <span className="text-xs text-cad-text font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function HistoryTab() {
  const revisions = useAppStore((s) => s.revisions);
  const currentRevisionId = useAppStore((s) => s.currentRevisionId);
  const restoreRevision = useAppStore((s) => s.restoreRevision);

  if (revisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-cad-muted">
        <p className="text-sm">No revisions yet</p>
        <p className="text-xs mt-1 opacity-60">Save a revision from the Parameters tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {[...revisions].reverse().map((rev) => {
        const isCurrent = rev.id === currentRevisionId;
        return (
          <button
            key={rev.id}
            onClick={() => {
              if (!isCurrent) restoreRevision(rev.id);
            }}
            className={`w-full text-left rounded px-3 py-2 border transition-colors ${
              isCurrent
                ? 'bg-cad-highlight/20 border-cad-highlight/40 text-cad-text'
                : 'bg-cad-accent/20 border-cad-border hover:bg-cad-accent/40 text-cad-muted hover:text-cad-text'
            }`}
          >
            <div className="flex items-center gap-2">
              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cad-highlight flex-shrink-0" />}
              <p className="text-xs font-medium truncate">{rev.notes}</p>
            </div>
            <p className="text-[10px] text-cad-muted/60 mt-0.5 ml-3.5">
              {formatTimestamp(rev.timestamp)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ---- Main Component ----

export default function RightPanel() {
  const rightPanelTab = useAppStore((s) => s.rightPanelTab);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);

  const activeTab = tabs.find((t) => tabToStoreTab[t] === rightPanelTab) ?? 'Model';

  const renderTabContent = () => {
    switch (rightPanelTab) {
      case 'selection':
        return <SelectionTab />;
      case 'measures':
        return <MeasuresTab />;
      case 'parameters':
        return <ParametersTab />;
      case 'model':
        return <ModelTab />;
      case 'history':
        return <HistoryTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-w-[300px] w-80 h-full bg-cad-bg border-l border-cad-border flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-cad-border bg-cad-surface shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setRightPanelTab(tabToStoreTab[tab])}
              className={`flex-1 min-w-0 px-2 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'text-cad-highlight border-b-2 border-cad-highlight bg-cad-bg'
                  : 'text-cad-muted hover:text-cad-text'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">{renderTabContent()}</div>
    </div>
  );
}
