import type { UIMessage } from 'ai'

export type { UIMessage }

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface AIProviderConfig {
  baseURL: string
  apiKey: string
  model: string
}

export interface AIContext {
  rootDir: string | null
  activeFile: string | null
  activeContent: string
  allFiles: FileEntry[]
}

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>
      readDir: (dirPath: string) => Promise<FileEntry[]>
      readFile: (filePath: string) => Promise<string>
      writeFile: (filePath: string, content: string) => Promise<void>
      createFile: (dirPath: string, fileName: string) => Promise<string>
      createFolder: (dirPath: string, folderName: string) => Promise<string>
      walk: (rootPath: string) => Promise<FileEntry[]>
      rename: (oldPath: string, newPath: string) => Promise<void>

      sendAIMessage: (messages: UIMessage[], config: Partial<AIProviderConfig>, context: AIContext) => Promise<void>
      onAIChunk: (cb: (chunk: string) => void) => void
      offAIChunk: (cb: (chunk: string) => void) => void
      onAIDone: (cb: () => void) => void
      offAIDone: (cb: () => void) => void
      onAIStep: (cb: (step: any) => void) => void
      offAIStep: (cb: (step: any) => void) => void
      onAIAgent: (cb: (agent: { type: string; label: string }) => void) => void
      offAIAgent: (cb: (agent: { type: string; label: string }) => void) => void

      // File-change notifications from main process
      onFileChange: (cb: (event: { filePath: string; action: 'created' | 'modified' }) => void) => void
      offFileChange: (cb: (event: { filePath: string; action: 'created' | 'modified' }) => void) => void

      loadAIConfig: () => Promise<AIProviderConfig>
      saveAIConfig: (config: AIProviderConfig) => Promise<void>
    }
  }
}
