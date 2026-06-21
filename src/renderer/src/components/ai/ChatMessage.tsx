import { useMemo } from 'react'
import MDEditor from '@uiw/react-md-editor'
import type { UIMessage } from 'ai'

interface ChatMessageProps {
  message: UIMessage
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  const textContent = useMemo(() => {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
  }, [message.parts])

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-avatar">{isUser ? 'You' : 'AI'}</div>
      <div className="chat-bubble">
        {isUser ? (
          <div className="chat-text">{textContent}</div>
        ) : (
          <MDEditor.Markdown source={textContent} />
        )}
      </div>
    </div>
  )
}
