import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import type { UIMessage } from 'ai'
import { getModel, AIProviderConfig } from './provider'
import { buildTools, ToolContext } from './tools'
import { routerAgent, getAgent } from './agents'
import { BrowserWindow } from 'electron'

export interface ChatRequest {
  messages: UIMessage[]
  config: Partial<AIProviderConfig>
  context: ToolContext
  windowId?: number
}

export async function handleChatStream(req: ChatRequest) {
  const startTime = Date.now()
  const model = getModel(req.config)
  const tools = buildTools({
    ...req.context,
    onFileChange: (filePath, action) => {
      console.log('[AI] file-change event:', action, filePath)
      if (req.windowId) {
        const win = BrowserWindow.fromId(req.windowId)
        if (win) {
          win.webContents.send('fs:fileChange', { filePath, action })
        }
      }
    },
  })

  console.log('[AI] ---------- chat started ----------')
  console.log('[AI] context:', {
    rootDir: req.context.rootDir,
    activeFile: req.context.activeFile,
    activeContentLength: req.context.activeContent.length,
    allFilesCount: req.context.allFiles.length,
  })
  console.log('[AI] model config:', req.config)

  // Router: classify intent
  const messagesForModel = req.messages.map(({ id: _id, ...rest }) => rest)
  const coreMessages = await convertToModelMessages(messagesForModel)
  console.log('[AI] converted messages:', coreMessages.length)
  coreMessages.forEach((m, i) => console.log(`[AI] msg[${i}] role=${(m as any).role} content=${String((m as any).content || '').slice(0, 120)}`))

  const agentType = await routerAgent(model, coreMessages)
  const agent = getAgent(agentType)
  console.log('[AI] router selected agent:', agentType, `(${agent.label})`)
  console.log('[AI] system prompt length:', agent.system.length)

  console.log('[AI] calling streamText with tools, stopWhen stepCountIs(5)')
  const result = streamText({
    model,
    system: agent.system,
    messages: coreMessages,
    tools,
    stopWhen: stepCountIs(5),
    prepareStep: async ({ stepNumber }) => {
      if (stepNumber === 1 && agentType !== 'general') {
        console.log('[AI] prepareStep: forcing toolChoice required for first step of', agentType)
        return { toolChoice: 'required' }
      }
      return {}
    },
    onStepFinish: (step) => {
      console.log('[AI] onStepFinish:', {
        stepNumber: (step as any).stepNumber,
        finishReason: step.finishReason,
        toolCallCount: step.toolCalls.length,
        toolResultCount: step.toolResults.length,
        textLength: step.text?.length ?? 0,
        usage: step.usage,
      })
      step.toolCalls.forEach((t, i) => {
        console.log(`[AI]   toolCall[${i}]`, (t as any).toolName, JSON.stringify((t as any).args).slice(0, 300))
      })
      step.toolResults.forEach((r, i) => {
        const result = (r as any).result
        console.log(`[AI]   toolResult[${i}]`, (r as any).toolName, typeof result === 'object' ? JSON.stringify(result).slice(0, 300) : String(result).slice(0, 300))
      })
      // Stream tool call indicators to renderer
      if (req.windowId) {
        const win = BrowserWindow.fromId(req.windowId)
        if (win) {
          win.webContents.send('ai:step', {
            toolCalls: step.toolCalls.map((t) => ({
              toolName: (t as any).toolName,
              args: (t as any).args,
            })),
            toolResults: step.toolResults.map((r) => ({
              toolName: (r as any).toolName,
              result:
                typeof (r as any).result === 'object'
                  ? JSON.stringify((r as any).result).slice(0, 500)
                  : String((r as any).result).slice(0, 500),
            })),
          })
        }
      }
    },
    onError: (event) => {
      console.error('[AI] streamText onError:', event.error)
    },
  })

  // Send agent type info
  if (req.windowId) {
    const win = BrowserWindow.fromId(req.windowId)
    if (win) {
      win.webContents.send('ai:agent', { type: agentType, label: agent.label })
    }
  }

  // Stream text chunks to renderer
  console.log('[AI] consuming textStream')
  let chunkCount = 0
  for await (const chunk of result.textStream) {
    chunkCount++
    if (chunkCount <= 3 || chunkCount % 10 === 0) {
      console.log(`[AI] text chunk #${chunkCount}:`, chunk.slice(0, 100))
    }
    if (req.windowId) {
      const win = BrowserWindow.fromId(req.windowId)
      if (win) {
        win.webContents.send('ai:chunk', chunk)
      }
    }
  }

  console.log('[AI] textStream consumed, total chunks:', chunkCount)

  try {
    const finalText = await result.text
    const finalToolCalls = await (result as any).toolCalls
    const finalToolResults = await (result as any).toolResults
    const finalSteps = await (result as any).steps
    console.log('[AI] final result:', {
      textLength: finalText?.length ?? 0,
      toolCallsCount: finalToolCalls?.length ?? 0,
      toolResultsCount: finalToolResults?.length ?? 0,
      stepsCount: finalSteps?.length ?? 0,
    })
  } catch (e) {
    console.error('[AI] failed to read final result:', e)
  }

  // Signal completion
  if (req.windowId) {
    const win = BrowserWindow.fromId(req.windowId)
    if (win) {
      win.webContents.send('ai:done')
    }
  }

  console.log(`[AI] ---------- chat finished (${Date.now() - startTime}ms) ----------`)
}
