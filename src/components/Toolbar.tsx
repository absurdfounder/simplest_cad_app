'use client';

import { useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { loadModel } from '@/lib/modelLoader';
import type { ViewPreset } from '@/types';

export default function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    setGeometry,
    setScene,
    setModelInfo,
    addConsoleMessage,
    viewPreset,
    setViewPreset,
    showWireframe,
    toggleWireframe,
    showGrid,
    toggleGrid,
    showAxes,
    toggleAxes,
    clipPlane,
    toggleClipPlane,
    clipPosition,
    setClipPosition,
  } = useAppStore();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      addConsoleMessage(`Loading file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      const result = await loadModel(file);
      setGeometry(result.geometry);
      setScene(result.scene);
      setModelInfo(result.info);
      addConsoleMessage(
        `Model loaded: ${result.info.name} | ${result.info.vertexCount} verts, ${result.info.faceCount} faces`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addConsoleMessage(`Load failed: ${message}`);
    }
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const viewPresets: { key: ViewPreset; label: string }[] = [
    { key: 'perspective', label: 'Persp' },
    { key: 'top', label: 'Top' },
    { key: 'front', label: 'Front' },
    { key: 'right', label: 'Right' },
  ];

  const toggleButtons: { label: string; active: boolean; onClick: () => void }[] = [
    { label: 'Wireframe', active: showWireframe, onClick: toggleWireframe },
    { label: 'Grid', active: showGrid, onClick: toggleGrid },
    { label: 'Axes', active: showAxes, onClick: toggleAxes },
    { label: 'Clip', active: clipPlane, onClick: toggleClipPlane },
  ];

  return (
    <div
      className="
        flex items-center gap-2 px-3 py-1.5
        bg-[#16213e] border-b border-[#2a2a4a]
        text-[#eaeaea] text-xs shrink-0
      "
    >
      {/* File upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl,.obj,.glb,.gltf,.3mf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="
          px-3 py-1 rounded font-medium transition-colors
          bg-[#0f3460] hover:bg-[#e94560]
        "
      >
        Open File
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-[#2a2a4a]" />

      {/* View presets */}
      {viewPresets.map((vp) => (
        <button
          key={vp.key}
          onClick={() => setViewPreset(vp.key)}
          className={`
            px-2 py-1 rounded font-medium transition-colors
            ${
              viewPreset === vp.key
                ? 'bg-[#e94560] text-[#eaeaea]'
                : 'bg-[#2a2a4a]/50 hover:bg-[#0f3460] text-[#eaeaea]/70 hover:text-[#eaeaea]'
            }
          `}
        >
          {vp.label}
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-5 bg-[#2a2a4a]" />

      {/* Toggle buttons */}
      {toggleButtons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          className={`
            px-2 py-1 rounded font-medium transition-colors
            ${
              btn.active
                ? 'bg-[#0f3460] text-[#eaeaea] ring-1 ring-[#e94560]/50'
                : 'bg-[#2a2a4a]/50 hover:bg-[#0f3460] text-[#eaeaea]/70 hover:text-[#eaeaea]'
            }
          `}
        >
          {btn.label}
        </button>
      ))}

      {/* Clip plane slider */}
      {clipPlane && (
        <input
          type="range"
          min={-100}
          max={100}
          value={clipPosition}
          onChange={(e) => setClipPosition(Number(e.target.value))}
          className="w-24 accent-[#e94560]"
        />
      )}

      {/* Separator */}
      <div className="w-px h-5 bg-[#2a2a4a]" />

      {/* Fit to screen */}
      <button
        onClick={() => setViewPreset('perspective')}
        className="
          px-2 py-1 rounded font-medium transition-colors
          bg-[#2a2a4a]/50 hover:bg-[#0f3460] text-[#eaeaea]/70 hover:text-[#eaeaea]
        "
      >
        Fit
      </button>
    </div>
  );
}
