'use client'

import ChatTab from '../components/ChatTab'

// Pagina chat a tutto schermo: è la "app chat" installabile (PWA dedicata,
// manifest /chat-manifest.webmanifest). Si apre direttamente sulla chat.
export default function ChatAppPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#0b0b14', padding: '12px 14px' }}>
      <ChatTab standalone />
    </div>
  )
}
