import { notFound } from 'next/navigation'
import App from '../page'
import { TAB_DI_SLUG } from '../../lib/tabUrl'

// /task, /weekly, … → la stessa app, aperta sulla tab scritta nell'indirizzo.
// Uno slug che non e' una tab e' un 404 vero, non una dashboard travestita.
export default function Sezione({ params }) {
  if (!TAB_DI_SLUG[String(params?.sezione || '').toLowerCase()]) notFound()
  return <App />
}
