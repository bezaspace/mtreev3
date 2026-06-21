import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { UIMessage } from 'ai'

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

const electronAPI = {
  selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  createFile: (dirPath: string, fileName: string) =>
    ipcRenderer.invoke('fs:createFile', dirPath, fileName),
  createFolder: (dirPath: string, folderName: string) =>
    ipcRenderer.invoke('fs:createFolder', dirPath, folderName),
  walk: (rootPath: string) => ipcRenderer.invoke('fs:walk', rootPath),
  rename: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('fs:rename', oldPath, newPath),

  // AI chat
  sendAIMessage: (messages: UIMessage[], config: Partial<AIProviderConfig>, context: AIContext) =>
    ipcRenderer.invoke('ai:send', messages, config, context),
  onAIChunk: (cb: (chunk: string) => void) =>
    ipcRenderer.on('ai:chunk', (_e: IpcRendererEvent, chunk: string) => cb(chunk)),
  offAIChunk: (cb: (chunk: string) => void) =>
    ipcRenderer.removeListener('ai:chunk', cb as any),
  onAIDone: (cb: () => void) =>
    ipcRenderer.on('ai:done', () => cb()),
  offAIDone: (cb: () => void) =>
    ipcRenderer.removeListener('ai:done', cb as any),
  onAIStep: (cb: (step: any) => void) =>
    ipcRenderer.on('ai:step', (_e: IpcRendererEvent, step: any) => cb(step)),
  offAIStep: (cb: (step: any) => void) =>
    ipcRenderer.removeListener('ai:step', cb as any),
  onAIAgent: (cb: (agent: { type: string; label: string }) => void) =>
    ipcRenderer.on('ai:agent', (_e: IpcRendererEvent, agent: any) => cb(agent)),
  offAIAgent: (cb: (agent: { type: string; label: string }) => void) =>
    ipcRenderer.removeListener('ai:agent', cb as any),

  // File-change notifications from main process
  onFileChange: (cb: (event: { filePath: string; action: 'created' | 'modified' }) => void) =>
    ipcRenderer.on('fs:fileChange', (_e: IpcRendererEvent, event: any) => cb(event)),
  offFileChange: (cb: (event: { filePath: string; action: 'created' | 'modified' }) => void) =>
    ipcRenderer.removeListener('fs:fileChange', cb as any),

  // Settings
  loadAIConfig: () => ipcRenderer.invoke('ai:loadConfig'),
  saveAIConfig: (config: AIProviderConfig) => ipcRenderer.invoke('ai:saveConfig', config),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as any).electronAPI = electronAPI
}
