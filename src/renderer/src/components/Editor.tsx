import { useEffect, useState } from 'react'
import MDEditor from '@uiw/react-md-editor'

type PreviewMode = 'edit' | 'live' | 'preview'

interface EditorProps {
  content: string
  onChange: (val: string) => void
  onSave: () => void
  fileName: string
  filePath?: string
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'])

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXTS.has(ext) : false
}

function Editor({ content, onChange, onSave, fileName, filePath }: EditorProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('edit')

  useEffect(() => {
    const cssLinks = [
      'node_modules/@uiw/react-md-editor/markdown-editor.css',
      'node_modules/@uiw/react-markdown-preview/markdown.css',
    ]
    cssLinks.forEach((href) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        document.head.appendChild(link)
      }
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSave])

  const modeBtn = (mode: PreviewMode, label: string) => (
    <button
      key={mode}
      className={`mode-btn ${previewMode === mode ? 'active' : ''}`}
      onClick={() => setPreviewMode(mode)}
      title={label}
    >
      {label}
    </button>
  )

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <span className="file-name">{fileName}</span>
        <div className="toolbar-right">
          <div className="mode-toggle">
            {modeBtn('edit', 'Edit')}
            {modeBtn('live', 'Split')}
            {modeBtn('preview', 'Preview')}
          </div>
          <span className="save-hint">⌘S to save</span>
        </div>
      </div>
      <div className="editor-body" data-color-mode="dark">
        {isImageFile(fileName) && filePath ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              background: '#1e1e2e',
              padding: 24,
            }}
          >
            <img
              src={`file://${filePath}`}
              alt={fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </div>
        ) : previewMode === 'preview' ? (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 24,
              background: '#1e1e2e',
            }}
          >
            <MDEditor.Markdown source={content} />
          </div>
        ) : (
          <MDEditor
            value={content}
            onChange={(val) => onChange(val || '')}
            height="calc(100vh - 48px)"
            preview={previewMode}
            hideToolbar={false}
          />
        )}
      </div>
    </div>
  )
}

export default Editor
