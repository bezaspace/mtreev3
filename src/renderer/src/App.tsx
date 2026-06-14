import { useState, useCallback, lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import './App.css'

const GraphView = lazy(() => import('./components/GraphView'))

type View = 'editor' | 'graph'
type FileEntry = { name: string; path: string; isDirectory: boolean }

function App() {
  const [view, setView] = useState<View>('editor')
  const [rootDir, setRootDir] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [allFiles, setAllFiles] = useState<FileEntry[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [pendingRename, setPendingRename] = useState<string | null>(null)

  const loadRootDir = useCallback(async (dir: string) => {
    setRootDir(dir)
    setActiveFile(null)
    setContent('')
    setRefreshToken(0)
    setPendingRename(null)
    const entries = await window.electronAPI.readDir(dir)
    setFiles(entries)
    const walked = await window.electronAPI.walk(dir)
    setAllFiles(walked)
  }, [])

  const refreshFileList = useCallback(async () => {
    if (!rootDir) return
    const entries = await window.electronAPI.readDir(rootDir)
    setFiles(entries)
    const walked = await window.electronAPI.walk(rootDir)
    setAllFiles(walked)
  }, [rootDir])

  const selectRootDir = async () => {
    const dir = await window.electronAPI.selectFolder()
    if (dir) {
      await loadRootDir(dir)
    }
  }

  const openFile = async (filePath: string) => {
    if (filePath.endsWith('/')) return
    setActiveFile(filePath)
    const text = await window.electronAPI.readFile(filePath)
    setContent(text)
    setView('editor')
  }

  const saveContent = async () => {
    if (!activeFile) return
    await window.electronAPI.writeFile(activeFile, content)
    await refreshFileList()
  }

  const createNote = async () => {
    if (!rootDir) return
    const safeName = `Untitled ${Date.now()}.md`
    const fullPath = await window.electronAPI.createFile(rootDir, safeName)
    setPendingRename(fullPath)
    setRefreshToken((t) => t + 1)
    await refreshFileList()
  }

  const createFolder = async () => {
    if (!rootDir) return
    await window.electronAPI.createFolder(rootDir, 'New Folder')
    setRefreshToken((t) => t + 1)
    await refreshFileList()
  }

  const renameFile = async (oldPath: string, newName: string) => {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = dir + '/' + newName
    await window.electronAPI.rename(oldPath, newPath)
    if (activeFile === oldPath) {
      setActiveFile(newPath)
    }
    await refreshFileList()
  }

  return (
    <div className="app">
      <Sidebar
        files={files}
        activeFile={activeFile}
        collapsed={collapsed}
        view={view}
        rootDir={rootDir}
        refreshToken={refreshToken}
        pendingRename={pendingRename}
        onSelectRoot={selectRootDir}
        onOpenFile={openFile}
        onCreateNote={createNote}
        onCreateFolder={createFolder}
        onToggleView={() => setView(view === 'editor' ? 'graph' : 'editor')}
        onToggleSidebar={() => setCollapsed(!collapsed)}
        onRename={renameFile}
        onClearPendingRename={() => setPendingRename(null)}
      />
      <main className="main">
        {view === 'editor' ? (
          <Editor
            content={content}
            onChange={setContent}
            onSave={saveContent}
            fileName={activeFile ? activeFile.split('/').pop()! : 'No file open'}
            filePath={activeFile || undefined}
          />
        ) : (
          <Suspense fallback={<div className="graph-empty"><h3>Loading graph...</h3></div>}>
            <GraphView allFiles={allFiles} rootDir={rootDir} onOpenFile={openFile} />
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default App
