import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { handleChatStream } from './ai/chat-stream'
import { loadAIConfig, saveAIConfig } from './ai/store'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// --- IPC Handlers ---

ipcMain.handle(
  'fs:selectFolder',
  async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) {
      return null
    }
    return result.filePaths[0]
  }
)

ipcMain.handle(
  'fs:readDir',
  async (_event, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries
        .filter((e) => !e.name.startsWith('.'))
        .map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          path: path.join(dirPath, e.name),
        }))
    } catch {
      return []
    }
  }
)

ipcMain.handle(
  'fs:readFile',
  async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  }
)

ipcMain.handle(
  'fs:writeFile',
  async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8')
  }
)

ipcMain.handle(
  'fs:createFile',
  async (_event, dirPath: string, fileName: string) => {
    const fullPath = path.join(dirPath, fileName)
    await fs.writeFile(fullPath, '', 'utf-8')
    return fullPath
  }
)

ipcMain.handle(
  'fs:createFolder',
  async (_event, dirPath: string, folderName: string) => {
    const fullPath = path.join(dirPath, folderName)
    await fs.mkdir(fullPath, { recursive: true })
    return fullPath
  }
)

ipcMain.handle(
  'fs:rename',
  async (_event, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
  }
)

ipcMain.handle(
  'fs:walk',
  async (_event, rootPath: string) => {
    const results: { name: string; path: string; isDirectory: boolean }[] = []

    async function walk(dir: string) {
      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const fullPath = path.join(dir, entry.name)
        results.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
        })
        if (entry.isDirectory()) {
          await walk(fullPath)
        }
      }
    }

    await walk(rootPath)
    return results
  }
)

// --- AI IPC Handlers ---

ipcMain.handle(
  'ai:send',
  async (event, messages: any[], config: any, context: any) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      console.error('[AI IPC] no window found for sender')
      return
    }
    console.log('[AI IPC] ai:send received', {
      windowId: win.id,
      messageCount: messages?.length ?? 0,
      lastMessage: messages?.length ? messages[messages.length - 1] : null,
    })
    const mergedContext = context || { rootDir: null, activeFile: null, activeContent: '', allFiles: [] }
    // Fire-and-forget stream; errors caught internally
    handleChatStream({
      messages,
      config: config || {},
      context: mergedContext,
      windowId: win.id,
    }).catch((err) => {
      console.error('[AI IPC] AI stream error:', err)
      win.webContents.send('ai:done')
    })
    return
  }
)

ipcMain.handle('ai:loadConfig', async () => loadAIConfig())
ipcMain.handle('ai:saveConfig', async (_event, config) => saveAIConfig(config))
