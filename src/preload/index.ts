import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
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
