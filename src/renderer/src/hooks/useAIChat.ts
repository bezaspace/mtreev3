import { useState, useCallback, useRef, useEffect } from 'react'
import type { UIMessage } from 'ai'
import type { AIProviderConfig, AIContext } from '../types/electron'

export interface AIStepInfo {
  toolCalls: Array<{ toolName: string; args: any }>
  toolResults: Array<{ toolName: string; result: string }>
}

export interface AIAgentInfo {
  type: string
  label: string
}

export function useAIChat(context: AIContext) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stepInfo, setStepInfo] = useState<AIStepInfo | null>(null)
  const [activeAgent, setActiveAgent] = useState<AIAgentInfo | null>(null)
  const [config, setConfig] = useState<AIProviderConfig>({
    baseURL: 'https://api.kilo.ai/api/gateway',
    apiKey: '',
    model: 'stepfun/step-3.7-flash:free',
  })
  const pendingAssistantId = useRef<string | null>(null)

  useEffect(() => {
    window.electronAPI.loadAIConfig().then((cfg) => {
      if (cfg) setConfig(cfg)
    })
  }, [])

  const saveConfig = useCallback(async (newConfig: AIProviderConfig) => {
    setConfig(newConfig)
    await window.electronAPI.saveAIConfig(newConfig)
  }, [])

  const handleChunk = useCallback((chunk: string) => {
    console.log('[AI renderer] chunk:', chunk.slice(0, 80))
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.role === 'assistant' && last.id === pendingAssistantId.current) {
        const updatedParts = [...last.parts]
        const lastPart = updatedParts[updatedParts.length - 1]
        if (lastPart && lastPart.type === 'text') {
          updatedParts[updatedParts.length - 1] = {
            ...lastPart,
            text: lastPart.text + chunk,
            state: 'streaming',
          }
        } else {
          updatedParts.push({ type: 'text', text: chunk, state: 'streaming' })
        }
        const updated = [...prev]
        updated[updated.length - 1] = { ...last, parts: updatedParts }
        return updated
      }
      return prev
    })
  }, [])

  const handleDone = useCallback(() => {
    console.log('[AI renderer] done')
    setIsLoading(false)
    pendingAssistantId.current = null
    setStepInfo(null)
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      const updatedParts = last.parts.map((part) =>
        part.type === 'text' ? { ...part, state: 'done' as const } : part
      )
      return [...prev.slice(0, -1), { ...last, parts: updatedParts }]
    })
  }, [])

  const handleStep = useCallback((step: AIStepInfo) => {
    console.log('[AI renderer] step:', {
      toolCalls: step.toolCalls.map((t) => t.toolName),
      toolResults: step.toolResults.map((r) => r.toolName),
    })
    setStepInfo(step)
  }, [])

  const handleAgent = useCallback((agent: AIAgentInfo) => {
    console.log('[AI renderer] agent:', agent)
    setActiveAgent(agent)
  }, [])

  useEffect(() => {
    window.electronAPI.onAIChunk(handleChunk)
    window.electronAPI.onAIDone(handleDone)
    window.electronAPI.onAIStep(handleStep)
    window.electronAPI.onAIAgent(handleAgent)
    return () => {
      window.electronAPI.offAIChunk(handleChunk)
      window.electronAPI.offAIDone(handleDone)
      window.electronAPI.offAIStep(handleStep)
      window.electronAPI.offAIAgent(handleAgent)
    }
  }, [handleChunk, handleDone, handleStep, handleAgent])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return
      console.log('[AI renderer] sendMessage:', content.trim())
      console.log('[AI renderer] context:', {
        rootDir: context.rootDir,
        activeFile: context.activeFile,
        activeContentLength: context.activeContent.length,
        allFilesCount: context.allFiles.length,
      })
      const userMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: content.trim() }],
      }
      const assistantId = crypto.randomUUID()
      pendingAssistantId.current = assistantId
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: 'assistant',
        parts: [{ type: 'text', text: '', state: 'streaming' }],
      }
      const newMessages = [...messages, userMsg, assistantMsg]
      setMessages(newMessages)
      setInput('')
      setIsLoading(true)
      setStepInfo(null)
      setActiveAgent(null)
      console.log('[AI renderer] invoking ai:send with', newMessages.length, 'messages')
      await window.electronAPI.sendAIMessage(newMessages, config, context)
    },
    [messages, isLoading, config, context]
  )

  const clearChat = useCallback(() => {
    setMessages([])
    setStepInfo(null)
    setActiveAgent(null)
    pendingAssistantId.current = null
  }, [])

  return {
    messages,
    input,
    setInput,
    isLoading,
    sendMessage,
    clearChat,
    config,
    saveConfig,
    stepInfo,
    activeAgent,
  }
}
