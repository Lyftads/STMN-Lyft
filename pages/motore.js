import Head from 'next/head'
import dynamic from 'next/dynamic'

// Solo nel browser: la board legge l'indirizzo e le misure della finestra.
const Board = dynamic(() => import('../lib/motore/ui/Board'), { ssr: false })

export default function PaginaMotore() {
  return (
    <>
      <Head>
        <title>Motore Creativo</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Board />
    </>
  )
}
