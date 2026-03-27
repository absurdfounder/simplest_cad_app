'use client';

import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import ChatPanel from '@/components/ChatPanel';
import RightPanel from '@/components/RightPanel';
import BottomTray from '@/components/BottomTray';
import Toolbar from '@/components/Toolbar';

const Viewport = dynamic(() => import('@/components/Viewport'), { ssr: false });

export default function Home() {
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const bottomTrayOpen = useAppStore((s) => s.bottomTrayOpen);
  const toggleLeftPanel = useAppStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const toggleBottomTray = useAppStore((s) => s.toggleBottomTray);

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden">
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Chat */}
        {leftPanelOpen && (
          <div className="panel-transition flex-shrink-0 border-r border-cad-border">
            <ChatPanel />
          </div>
        )}

        {/* Center area - Toolbar + Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Toolbar />
          <div className="flex-1 relative">
            <Viewport />
            {/* Panel toggle buttons */}
            <button
              onClick={toggleLeftPanel}
              className="absolute left-2 top-2 z-10 p-1.5 rounded bg-cad-surface/80 hover:bg-cad-accent text-cad-muted hover:text-cad-text text-xs"
              title={leftPanelOpen ? 'Hide chat' : 'Show chat'}
            >
              {leftPanelOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 5l7 7-7 7M6 5l7 7-7 7" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleRightPanel}
              className="absolute right-2 top-2 z-10 p-1.5 rounded bg-cad-surface/80 hover:bg-cad-accent text-cad-muted hover:text-cad-text text-xs"
              title={rightPanelOpen ? 'Hide inspector' : 'Show inspector'}
            >
              {rightPanelOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 5l7 7-7 7M6 5l7 7-7 7" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleBottomTray}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded bg-cad-surface/80 hover:bg-cad-accent text-cad-muted hover:text-cad-text text-xs"
              title={bottomTrayOpen ? 'Hide tray' : 'Show tray'}
            >
              {bottomTrayOpen ? '▼ Hide' : '▲ Versions / Export / Console'}
            </button>
          </div>

          {/* Bottom tray */}
          {bottomTrayOpen && (
            <div className="panel-transition flex-shrink-0 border-t border-cad-border">
              <BottomTray />
            </div>
          )}
        </div>

        {/* Right panel - Inspector */}
        {rightPanelOpen && (
          <div className="panel-transition flex-shrink-0 border-l border-cad-border">
            <RightPanel />
          </div>
        )}
      </div>
    </div>
  );
}
