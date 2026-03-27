'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { sendChatMessage } from '@/lib/aiService';

function formatMessage(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = '';
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('```') && !inCodeBlock) {
      inCodeBlock = true;
      codeLanguage = line.slice(3).trim();
      codeBuffer = [];
      continue;
    }
    if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false;
      parts.push(
        <pre
          key={key++}
          className="bg-[#0d1117] text-[#8892b0] text-xs rounded p-2 my-1 overflow-x-auto font-mono"
        >
          <code>{codeBuffer.join('\n')}</code>
        </pre>
      );
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Process inline formatting
    const formatted = formatInline(line, key);
    key = formatted.nextKey;
    parts.push(
      <span key={key++} className="block">
        {formatted.nodes}
      </span>
    );
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    parts.push(
      <pre
        key={key++}
        className="bg-[#0d1117] text-[#8892b0] text-xs rounded p-2 my-1 overflow-x-auto font-mono"
      >
        <code>{codeBuffer.join('\n')}</code>
      </pre>
    );
  }

  return parts;
}

function formatInline(
  text: string,
  startKey: number
): { nodes: React.ReactNode[]; nextKey: number } {
  const nodes: React.ReactNode[] = [];
  let key = startKey;

  // Split by bold (**text**) and inline code (`text`)
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // Bold
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline code
      nodes.push(
        <code
          key={key++}
          className="bg-[#0d1117] text-[#e6db74] text-xs px-1 py-0.5 rounded font-mono"
        >
          {match[3]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  if (nodes.length === 0) {
    // Empty line spacer
    nodes.push(<br key={key++} />);
  }

  return { nodes, nextKey: key };
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'user') {
    return (
      <div className="w-6 h-6 rounded-full bg-[#0f3460] flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-[#eaeaea]" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  if (role === 'assistant') {
    return (
      <div className="w-6 h-6 rounded-full bg-[#1a4a1a] flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-[#4ade80]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l.707.707.707-.707A1 1 0 0115.414 3l-.707.707.707.707a1 1 0 01-1.414 1.414L13.293 5.12l-.707.707a1 1 0 01-1.414-1.414l.707-.707-.707-.707A1 1 0 0112 2z" />
        </svg>
      </div>
    );
  }
  // system
  return (
    <div className="w-6 h-6 rounded-full bg-[#2a2a4a] flex items-center justify-center flex-shrink-0">
      <svg className="w-3.5 h-3.5 text-[#8892b0]" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

export default function ChatPanel() {
  const {
    messages,
    apiKey,
    chatLoading,
    modelInfo,
    addMessage,
    setApiKey,
    setChatLoading,
    getModelContext,
    applyAction,
    markMessageApplied,
    loadDemoModel,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || chatLoading) return;

    setInput('');
    addMessage('user', trimmed);
    setChatLoading(true);

    try {
      // Build messages array from store (filter out system messages)
      const chatMessages = [...useAppStore.getState().messages]
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));

      const context = getModelContext();
      const response = await sendChatMessage(apiKey, chatMessages, context);
      addMessage('assistant', response.content, response.action);
    } catch (err: any) {
      addMessage('assistant', `Error: ${err.message || 'Something went wrong.'}`);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-w-[320px] w-80 h-full flex flex-col bg-[#16213e] border-r border-[#0f3460]/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#0f3460]/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#eaeaea] tracking-wide uppercase">
            AI Assistant
          </h2>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="text-[#8892b0] hover:text-[#eaeaea] transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Collapsible Settings */}
        {settingsOpen && (
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-[#8892b0]">Anthropic API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-2 py-1.5 text-xs rounded bg-[#1a1a2e] border border-[#0f3460] text-[#eaeaea] placeholder-[#8892b0]/50 focus:outline-none focus:border-[#4ade80]/50"
            />
            <p className="text-[10px] text-[#8892b0]/60">
              Optional. Without a key, simulated responses are used.
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
        {/* Load Demo Model prompt */}
        {!modelInfo && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#0f3460]/50 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[#8892b0]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <p className="text-sm text-[#8892b0]">
              No model loaded. Load a demo model or upload a file to get started.
            </p>
            <button
              onClick={loadDemoModel}
              className="px-4 py-2 text-sm font-medium rounded bg-[#0f3460] text-[#eaeaea] hover:bg-[#0f3460]/80 transition-colors"
            >
              Load Demo Model
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2 group">
            <RoleIcon role={msg.role} />
            <div className="flex-1 min-w-0">
              <div
                className={`text-xs leading-relaxed ${
                  msg.role === 'system'
                    ? 'text-[#8892b0] italic'
                    : msg.role === 'user'
                    ? 'text-[#eaeaea]'
                    : 'text-[#c8cedd]'
                }`}
              >
                {formatMessage(msg.content)}
              </div>

              {/* Action buttons for assistant messages */}
              {msg.role === 'assistant' && msg.action && (
                <div className="mt-2 flex items-center gap-2">
                  {msg.applied ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#4ade80] font-medium">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Applied
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          applyAction(msg.action!);
                          markMessageApplied(msg.id);
                        }}
                        className="px-2.5 py-1 text-[10px] font-medium rounded bg-[#166534] text-[#4ade80] hover:bg-[#15803d] transition-colors"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => {
                          // Preview shows the action description
                          if (msg.action?.description) {
                            addMessage('system', `Preview: ${msg.action.description}`);
                          }
                          if (msg.action?.changes) {
                            addMessage(
                              'system',
                              `Changes: ${JSON.stringify(msg.action.changes, null, 2)}`
                            );
                          }
                        }}
                        className="px-2.5 py-1 text-[10px] font-medium rounded bg-[#1a1a2e] text-[#8892b0] hover:text-[#eaeaea] hover:bg-[#0f3460]/50 transition-colors border border-[#0f3460]/50"
                      >
                        Preview
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {chatLoading && (
          <div className="flex gap-2">
            <RoleIcon role="assistant" />
            <div className="flex items-center gap-1 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-[#0f3460]/50 flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={modelInfo ? 'Ask about the model...' : 'Load a model first...'}
            disabled={chatLoading}
            className="flex-1 px-3 py-2 text-xs rounded bg-[#1a1a2e] border border-[#0f3460] text-[#eaeaea] placeholder-[#8892b0]/50 focus:outline-none focus:border-[#4ade80]/50 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatLoading}
            className="px-3 py-2 rounded bg-[#0f3460] text-[#eaeaea] hover:bg-[#0f3460]/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send message"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
