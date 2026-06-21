import { useState, useRef, useEffect } from 'react'
import { useAIChat } from '../../hooks/useAIChat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import AISettings from './AISettings'
import type { AIContext } from '../../types/electron'

interface AIChatPanelProps {
  context: AIContext
  collapsed: boolean
  onToggle: () => void
}

export default function AIChatPanel({ context, collapsed, onToggle }: AIChatPanelProps) {
  const { messages, input, setInput, isLoading, sendMessage, clearChat, config, saveConfig, stepInfo, activeAgent } =
    useAIChat(context)
  const [showSettings, setShowSettings] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, stepInfo])

  useEffect(() => {
    console.log('[AI panel] activeAgent changed:', activeAgent)
  }, [activeAgent])

  useEffect(() => {
    console.log('[AI panel] stepInfo changed:', stepInfo)
  }, [stepInfo])

  if (collapsed) {
    return (
      <button className="ai-panel-toggle-collapsed" onClick={onToggle} title="Open AI Chat">
        AI
      </button>
    )
  }

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <span className="ai-chat-title">AI Chat</span>
          {activeAgent && (
            <span className="ai-agent-badge">{activeAgent.label}</span>
          )}
        </div>
        <div className="ai-chat-header-right">
          <button className="icon-btn" onClick={clearChat} title="Clear chat">
            Clear
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
            Settings
          </button>
          <button className="icon-btn" onClick={onToggle} title="Close panel">
            Close
          </button>
        </div>
      </div>

      <div className="ai-chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            <p>Ask me anything about your notes.</p>
            <p className="ai-chat-hint">I can create notes, search your vault, analyze your graph, and more.</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && stepInfo && stepInfo.toolCalls.length > 0 && (
          <div className="ai-tool-indicator">
            {stepInfo.toolCalls.map((tc, i) => (
              <span key={i} className="ai-tool-badge">
                {tc.toolName}
              </span>
            ))}
          </div>
        )}
      </div>

      <ChatInput input={input} setInput={setInput} onSend={() => sendMessage(input)} isLoading={isLoading} />

      {showSettings && (
        <AISettings config={config} onSave={saveConfig} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
