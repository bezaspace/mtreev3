import { useRef } from 'react'

interface ChatInputProps {
  input: string
  setInput: (val: string) => void
  onSend: () => void
  isLoading: boolean
}

export default function ChatInput({ input, setInput, onSend, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSend()
    textareaRef.current?.focus()
  }

  return (
    <div className="chat-input-bar">
      <textarea
        ref={textareaRef}
        className="chat-textarea"
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything..."
        disabled={isLoading}
      />
      <button
        className="chat-send-btn"
        onClick={handleSend}
        disabled={isLoading || !input.trim()}
        title="Send"
      >
        Send
      </button>
    </div>
  )
}
