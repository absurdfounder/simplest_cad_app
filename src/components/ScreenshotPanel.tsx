'use client';

import React, { useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  captureScreenshots,
  captureParametricScreenshots,
  screenshotsToAIContext,
  downloadScreenshots,
  getAvailableAngles,
  type ScreenshotResult,
} from '@/lib/screenshotRenderer';

const QUICK_PRESETS = [
  { name: '4-View Standard', angles: ['perspective', 'front', 'right', 'top'] },
  { name: '6-View Full', angles: ['perspective', 'front', 'back', 'right', 'left', 'top'] },
  { name: 'All Angles', angles: ['perspective', 'front', 'back', 'right', 'left', 'top', 'bottom', 'iso_front_right', 'iso_front_left', 'iso_back_right'] },
  { name: 'Isometric Only', angles: ['iso_front_right', 'iso_front_left', 'iso_back_right'] },
];

export default function ScreenshotPanel() {
  const geometry = useAppStore((s) => s.geometry);
  const paramSchema = useAppStore((s) => s.paramSchema);
  const paramValues = useAppStore((s) => s.paramValues);
  const modelInfo = useAppStore((s) => s.modelInfo);
  const addConsoleMessage = useAppStore((s) => s.addConsoleMessage);

  const [screenshots, setScreenshots] = useState<ScreenshotResult[]>([]);
  const [selectedAngles, setSelectedAngles] = useState<string[]>(['perspective', 'front', 'right', 'top']);
  const [resolution, setResolution] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [capturing, setCapturing] = useState(false);
  const [selectedShot, setSelectedShot] = useState<ScreenshotResult | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const allAngles = getAvailableAngles();

  const handleCapture = useCallback(async () => {
    setCapturing(true);
    try {
      let results: ScreenshotResult[];

      if (paramSchema && Object.keys(paramValues).length > 0) {
        results = captureParametricScreenshots(paramSchema, paramValues, {
          width: resolution.w,
          height: resolution.h,
          angles: selectedAngles,
        });
      } else if (geometry) {
        results = captureScreenshots(geometry, {
          width: resolution.w,
          height: resolution.h,
          angles: selectedAngles,
        });
      } else {
        addConsoleMessage('No model loaded to capture');
        setCapturing(false);
        return;
      }

      setScreenshots(results);
      addConsoleMessage(`Captured ${results.length} screenshots from angles: ${selectedAngles.join(', ')}`);

      // Upload to API for AI agent access
      const aiContext = screenshotsToAIContext(results);
      try {
        const resp = await fetch('/api/screenshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshots: aiContext,
            model_name: modelInfo?.name || 'unknown',
            parameters: paramValues,
          }),
        });
        const data = await resp.json();
        setUploadStatus(`Stored ${data.stored} screenshots for AI access`);
        addConsoleMessage(`Screenshots stored on server: ${data.stored} images available at /api/screenshots`);
      } catch {
        setUploadStatus('Server upload failed (screenshots still available locally)');
      }
    } catch (err: any) {
      addConsoleMessage(`Screenshot error: ${err.message}`);
    }
    setCapturing(false);
  }, [geometry, paramSchema, paramValues, selectedAngles, resolution, modelInfo, addConsoleMessage]);

  const handleDownload = useCallback(() => {
    if (screenshots.length > 0) {
      downloadScreenshots(screenshots, modelInfo?.name || 'model');
      addConsoleMessage(`Downloaded ${screenshots.length} screenshots`);
    }
  }, [screenshots, modelInfo, addConsoleMessage]);

  const toggleAngle = (angle: string) => {
    setSelectedAngles((prev) =>
      prev.includes(angle) ? prev.filter((a) => a !== angle) : [...prev, angle]
    );
  };

  const applyPreset = (angles: string[]) => {
    setSelectedAngles(angles);
  };

  const hasModel = !!geometry || (!!paramSchema && Object.keys(paramValues).length > 0);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Controls Row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Quick Presets */}
        <div className="flex gap-1">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset.angles)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                JSON.stringify(selectedAngles.sort()) === JSON.stringify([...preset.angles].sort())
                  ? 'bg-cad-highlight text-white'
                  : 'bg-cad-accent/50 text-cad-muted hover:bg-cad-accent hover:text-cad-text'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-cad-border" />

        {/* Resolution */}
        <div className="flex items-center gap-1 text-xs text-cad-muted">
          <span>Res:</span>
          <select
            value={`${resolution.w}x${resolution.h}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              setResolution({ w, h });
            }}
            className="bg-cad-accent/50 text-cad-text text-xs px-1.5 py-1 rounded border border-cad-border"
          >
            <option value="400x300">400x300</option>
            <option value="800x600">800x600</option>
            <option value="1200x900">1200x900</option>
            <option value="1600x1200">1600x1200</option>
          </select>
        </div>

        <div className="w-px h-6 bg-cad-border" />

        {/* Capture + Download */}
        <button
          onClick={handleCapture}
          disabled={!hasModel || capturing}
          className="px-3 py-1.5 text-xs font-medium rounded bg-cad-highlight hover:bg-cad-highlight/80 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {capturing ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full spinner" />
              Capturing...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21,15 16,10 5,21" />
              </svg>
              Capture Screenshots
            </>
          )}
        </button>

        {screenshots.length > 0 && (
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs font-medium rounded bg-cad-success/20 hover:bg-cad-success/30 text-cad-success flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download All ({screenshots.length})
          </button>
        )}

        {uploadStatus && (
          <span className="text-xs text-cad-success/80">{uploadStatus}</span>
        )}
      </div>

      {/* Angle Selector */}
      <div className="flex flex-wrap gap-1">
        {allAngles.map(({ name, label }) => (
          <button
            key={name}
            onClick={() => toggleAngle(name)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              selectedAngles.includes(name)
                ? 'bg-cad-accent text-cad-text ring-1 ring-cad-highlight/50'
                : 'bg-cad-bg text-cad-muted hover:bg-cad-accent/50'
            }`}
            title={label}
          >
            {name.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Screenshot Gallery */}
      {screenshots.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 flex-1 min-h-0">
          {screenshots.map((shot) => (
            <div
              key={shot.angle}
              className={`flex-shrink-0 cursor-pointer rounded overflow-hidden border transition-all ${
                selectedShot?.angle === shot.angle
                  ? 'border-cad-highlight ring-1 ring-cad-highlight/30'
                  : 'border-cad-border hover:border-cad-muted'
              }`}
              onClick={() => setSelectedShot(selectedShot?.angle === shot.angle ? null : shot)}
            >
              <div className="relative">
                <img
                  src={shot.dataUrl}
                  alt={shot.label}
                  className="h-[120px] w-auto object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-cad-bg/80 px-1.5 py-0.5 text-[10px] text-cad-text">
                  {shot.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-cad-muted text-sm">
          {hasModel
            ? 'Click "Capture Screenshots" to render views'
            : 'Load a model first to capture screenshots'}
        </div>
      )}

      {/* Enlarged view */}
      {selectedShot && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setSelectedShot(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedShot.dataUrl}
              alt={selectedShot.label}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <a
                href={selectedShot.dataUrl}
                download={`${modelInfo?.name || 'model'}_${selectedShot.angle}.png`}
                className="px-2 py-1 text-xs bg-cad-surface/90 text-cad-text rounded hover:bg-cad-accent"
              >
                Download
              </a>
              <button
                onClick={() => setSelectedShot(null)}
                className="px-2 py-1 text-xs bg-cad-surface/90 text-cad-text rounded hover:bg-cad-accent"
              >
                Close
              </button>
            </div>
            <div className="absolute bottom-2 left-2 bg-cad-bg/80 px-3 py-1.5 rounded text-sm text-cad-text">
              {selectedShot.label} &mdash; {selectedShot.width}x{selectedShot.height}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
