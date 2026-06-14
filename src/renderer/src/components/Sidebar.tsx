import { useState, useEffect, useCallback } from 'react'

type FileEntry = { name: string; path: string; isDirectory: boolean }

interface SidebarProps {
  files: FileEntry[]
  activeFile: string | null
  collapsed: boolean
  view: string
  rootDir: string | null
  refreshToken: number
  pendingRename: string | null
  onSelectRoot: () => void
  onOpenFile: (path: string) => void
  onCreateNote: () => void
  onCreateFolder: () => void
  onToggleView: () => void
  onToggleSidebar: () => void
  onRename: (oldPath: string, newName: string) => Promise<void>
  onClearPendingRename: () => void
}

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
  activeFile: string | null
  renamingPath: string | null
  renameValue: string
  expandedDirs: Set<string>
  dirContents: Record<string, FileEntry[]>
  pendingRename: string | null
  onToggleDir: (path: string) => void
  onOpenFile: (path: string) => void
  onStartRename: (path: string, name: string) => void
  onRenameSubmit: () => void
  onRenameChange: (value: string) => void
  onRenameCancel: () => void
  onClearPendingRename: () => void
}

function FileTreeItem({
  entry,
  depth,
  activeFile,
  renamingPath,
  renameValue,
  expandedDirs,
  dirContents,
  pendingRename,
  onToggleDir,
  onOpenFile,
  onStartRename,
  onRenameSubmit,
  onRenameChange,
  onRenameCancel,
  onClearPendingRename,
}: FileTreeItemProps) {
  const isExpanded = expandedDirs.has(entry.path)
  const isRenaming = renamingPath === entry.path
  const children = dirContents[entry.path] || []

  useEffect(() => {
    if (pendingRename === entry.path && !isRenaming) {
      onStartRename(entry.path, entry.name)
      onClearPendingRename()
    }
  }, [pendingRename, entry.path, entry.name, isRenaming])

  const ext = entry.name.split('.').pop()
  const icon = entry.isDirectory
    ? isExpanded
      ? '📂'
      : '📁'
    : ext === 'md'
      ? '📝'
      : '📄'

  return (
    <div>
      <div
        className={`file-item ${activeFile === entry.path ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 14}px` }}
        onClick={() => {
          if (entry.isDirectory) {
            onToggleDir(entry.path)
          } else {
            onOpenFile(entry.path)
          }
        }}
      >
        <span className="file-icon">{icon}</span>
        {isRenaming ? (
          <input
            className="rename-input"
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit()
              if (e.key === 'Escape') onRenameCancel()
            }}
            onBlur={onRenameSubmit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-name">{entry.name}</span>
        )}
      </div>
      {entry.isDirectory && isExpanded && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              activeFile={activeFile}
              renamingPath={renamingPath}
              renameValue={renameValue}
              expandedDirs={expandedDirs}
              dirContents={dirContents}
              pendingRename={pendingRename}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              onStartRename={onStartRename}
              onRenameSubmit={onRenameSubmit}
              onRenameChange={onRenameChange}
              onRenameCancel={onRenameCancel}
              onClearPendingRename={onClearPendingRename}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar({
  files,
  activeFile,
  collapsed,
  view,
  rootDir,
  refreshToken,
  pendingRename,
  onSelectRoot,
  onOpenFile,
  onCreateNote,
  onCreateFolder,
  onToggleView,
  onToggleSidebar,
  onRename,
  onClearPendingRename,
}: SidebarProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [dirContents, setDirContents] = useState<Record<string, FileEntry[]>>({})
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const handleToggleDir = useCallback(
    async (dirPath: string) => {
      const next = new Set(expandedDirs)
      if (next.has(dirPath)) {
        next.delete(dirPath)
        setExpandedDirs(next)
      } else {
        next.add(dirPath)
        setExpandedDirs(next)
        if (!dirContents[dirPath]) {
          const children = await window.electronAPI.readDir(dirPath)
          setDirContents((prev) => ({ ...prev, [dirPath]: children }))
        }
      }
    },
    [expandedDirs, dirContents]
  )

  const handleStartRename = useCallback((path: string, name: string) => {
    setRenamingPath(path)
    setRenameValue(name)
  }, [])

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null)
      return
    }
    await onRename(renamingPath, renameValue.trim())
    setRenamingPath(null)
  }, [renamingPath, renameValue, onRename])

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && activeFile && !renamingPath) {
        const name = activeFile.split('/').pop() || ''
        handleStartRename(activeFile, name)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeFile, renamingPath, handleStartRename])

  useEffect(() => {
    if (!rootDir) {
      setExpandedDirs(new Set())
      setDirContents({})
    }
  }, [rootDir, refreshToken])

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2 className="logo">Marktree</h2>
        <button className="icon-btn" onClick={onToggleSidebar} title="Toggle sidebar">
          {'◀'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="sidebar-actions">
            {!rootDir ? (
              <button className="primary-btn" onClick={onSelectRoot}>
                Open Folder
              </button>
            ) : (
              <button className="secondary-btn" onClick={onSelectRoot}>
                Change Folder
              </button>
            )}
            <div className="action-row">
              <button
                className="icon-btn secondary"
                onClick={onCreateNote}
                title="New note"
              >
                {'＋'}
              </button>
              <button
                className="icon-btn secondary"
                onClick={onCreateFolder}
                title="New folder"
              >
                {'📁'}
              </button>
              <button className="icon-btn secondary" onClick={onToggleView} title="Toggle view">
                {view === 'editor' ? '◉' : '✎'}
              </button>
            </div>
          </div>
          {rootDir && (
            <div className="folder-info">
              <span className="folder-path" title={rootDir}>
                {rootDir.split('/').pop()}
              </span>
            </div>
          )}
          <div className="file-tree">
            {files.map((file) => (
              <FileTreeItem
                key={file.path}
                entry={file}
                depth={0}
                activeFile={activeFile}
                renamingPath={renamingPath}
                renameValue={renameValue}
                expandedDirs={expandedDirs}
                dirContents={dirContents}
                pendingRename={pendingRename}
                onToggleDir={handleToggleDir}
                onOpenFile={onOpenFile}
                onStartRename={handleStartRename}
                onRenameSubmit={handleRenameSubmit}
                onRenameChange={setRenameValue}
                onRenameCancel={handleRenameCancel}
                onClearPendingRename={onClearPendingRename}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  )
}

export default Sidebar
