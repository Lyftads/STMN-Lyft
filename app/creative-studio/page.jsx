'use client'

import { useState } from 'react'
import CreativeStudio from '../components/CreativeStudio'
import BoardsHome from '../components/studio/BoardsHome'

// Creative Studio a tutto schermo. Prima la home "I miei progetti" (board
// multiple, a tela infinita); aprendo una board si entra nello Studio per quel
// progetto, con un tasto per tornare ai progetti.
export default function CreativeStudioAppPage() {
  const [board, setBoard] = useState(null) // { id, title } | null
  const [initialPrompt, setInitialPrompt] = useState('')

  return (
    <div style={{
      height: '100dvh',
      overflow: 'hidden',
      background: 'radial-gradient(1100px 760px at 12% -10%, rgba(123,91,255,0.20), transparent 60%), radial-gradient(1000px 720px at 100% 110%, rgba(91,139,255,0.16), transparent 60%), #07070e',
    }}>
      {board ? (
        <CreativeStudio standalone boardId={board.id} boardTitle={board.title} initialPrompt={initialPrompt} onExit={() => { setBoard(null); setInitialPrompt('') }} />
      ) : (
        <BoardsHome onOpen={(b, p) => { setInitialPrompt(p || ''); setBoard(b) }} />
      )}
    </div>
  )
}
