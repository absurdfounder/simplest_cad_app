'use client';

import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { exportSTL, exportOBJ } from '@/lib/modelLoader';

export default function BottomTray() {
  const {
    bottomTrayOpen,
    toggleBottomTray,
    bottomTrayTab,
    setBottomTrayTab,
    revisions,
    currentRevisionId,
    restoreRevision,
    geometry,
    consoleMessages,
    addConsoleMessage,
  } = useAppStore();

  const [exportFilename, setExportFilename] = useState('model');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (bottomTrayTab === 'console' && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleMessages, bottomTrayTab]);

  const handleExportSTL = () => {
    if (!geometry) {
      addConsoleMessage('Export failed: No geometry loaded');
      return;
    }
    try {
      exportSTL(geometry, exportFilename);
      addConsoleMessage(`Exported STL: ${exportFilename}.stl`);
    } catch (err) {
      addConsoleMessage(`Export STL error: ${err}`);
    }
  };

  const handleExportOBJ = () => {
    if (!geometry) {
      addConsoleMessage('Export failed: No geometry loaded');
      return;
    }
    try {
      exportOBJ(geometry, exportFilename);
      addConsoleMessage(`Exported OBJ: ${exportFilename}.obj`);
    } catch (err) {
      addConsoleMessage(`Export OBJ error: ${err}`);
    }
  };

  const tabs: { key: typeof bottomTrayTab; label: string }[] = [
    { key: 'versions', label: 'Versions' },
    { key: 'export', label: 'Export' },
    { key: 'console', label: 'Console' },
  ];

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-30
        transition-transform duration-300 ease-in-out
        ${bottomTrayOpen ? 'translate-y-0' : 'translate-y-[200px]'}
      `}
    >
      {/* Toggle button */}
      <div className="flex justify-center">
        <button
          onClick={toggleBottomTray}
          className="
            px-4 py-1 rounded-t-md text-xs font-medium
            bg-[#16213e] border border-b-0 border-[#2a2a4a] text-[#eaeaea]
            hover:bg-[#0f3460] transition-colors
          "
        >
          {bottomTrayOpen ? '▼ Hide Tray' : '▲ Show Tray'}
        </button>
      </div>

      {/* Tray body */}
      <div className="h-[200px] bg-[#16213e] border-t border-[#2a2a4a] flex flex-col">
        {/* Tab bar */}
        <div className="flex border-b border-[#2a2a4a] shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setBottomTrayTab(tab.key)}
              className={`
                px-4 py-1.5 text-xs font-medium transition-colors
                ${
                  bottomTrayTab === tab.key
                    ? 'bg-[#0f3460] text-[#eaeaea] border-b-2 border-[#e94560]'
                    : 'text-[#eaeaea]/60 hover:text-[#eaeaea] hover:bg-[#0f3460]/40'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto p-3 text-xs text-[#eaeaea]">
          {/* Versions tab */}
          {bottomTrayTab === 'versions' && (
            <div className="space-y-1">
              {revisions.length === 0 ? (
                <p className="text-[#eaeaea]/40 italic">No revisions yet. Save a revision to track changes.</p>
              ) : (
                revisions.map((rev) => (
                  <div
                    key={rev.id}
                    onClick={() => restoreRevision(rev.id)}
                    className={`
                      flex items-center justify-between px-3 py-1.5 rounded cursor-pointer
                      transition-colors
                      ${
                        rev.id === currentRevisionId
                          ? 'bg-[#0f3460] border border-[#e94560]/50'
                          : 'bg-[#2a2a4a]/30 hover:bg-[#0f3460]/50 border border-transparent'
                      }
                    `}
                  >
                    <span className="truncate mr-3">{rev.notes || 'Untitled revision'}</span>
                    <span className="text-[#eaeaea]/40 shrink-0">
                      {new Date(rev.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Export tab */}
          {bottomTrayTab === 'export' && (
            <div className="flex items-start gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[#eaeaea]/60">Filename</label>
                <input
                  type="text"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  className="
                    px-2 py-1 rounded text-xs
                    bg-[#2a2a4a] border border-[#2a2a4a] text-[#eaeaea]
                    focus:outline-none focus:border-[#e94560]
                    w-48
                  "
                  placeholder="model"
                />
              </div>
              <div className="flex flex-col gap-2 pt-5">
                <button
                  onClick={handleExportSTL}
                  disabled={!geometry}
                  className="
                    px-4 py-1.5 rounded text-xs font-medium transition-colors
                    bg-[#0f3460] text-[#eaeaea] hover:bg-[#e94560]
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0f3460]
                  "
                >
                  Export STL
                </button>
                <button
                  onClick={handleExportOBJ}
                  disabled={!geometry}
                  className="
                    px-4 py-1.5 rounded text-xs font-medium transition-colors
                    bg-[#0f3460] text-[#eaeaea] hover:bg-[#e94560]
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0f3460]
                  "
                >
                  Export OBJ
                </button>
              </div>
            </div>
          )}

          {/* Console tab */}
          {bottomTrayTab === 'console' && (
            <div className="font-mono space-y-0.5">
              {consoleMessages.length === 0 ? (
                <p className="text-[#eaeaea]/40 italic">No messages yet.</p>
              ) : (
                consoleMessages.map((msg, i) => (
                  <div key={i} className="text-[#eaeaea]/80 leading-5">
                    {msg}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
