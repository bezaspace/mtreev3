import { useState } from 'react'
import type { AIProviderConfig } from '../../types/electron'

interface AISettingsProps {
  config: AIProviderConfig
  onSave: (cfg: AIProviderConfig) => void
  onClose: () => void
}

export default function AISettings({ config, onSave, onClose }: AISettingsProps) {
  const [form, setForm] = useState<AIProviderConfig>({ ...config })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
    onClose()
  }

  return (
    <div className="ai-settings-overlay" onClick={onClose}>
      <div className="ai-settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ai-settings-title">AI Provider Settings</h3>
        <form onSubmit={handleSubmit} className="ai-settings-form">
          <div className="ai-settings-field">
            <label>Base URL</label>
            <input
              type="text"
              value={form.baseURL}
              onChange={(e) => setForm({ ...form, baseURL: e.target.value })}
              placeholder="http://localhost:11434/v1"
            />
            <small>OpenAI-compatible API endpoint</small>
          </div>
          <div className="ai-settings-field">
            <label>API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
          <div className="ai-settings-field">
            <label>Model</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="llama3.2"
            />
          </div>
          <div className="ai-settings-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-btn">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
