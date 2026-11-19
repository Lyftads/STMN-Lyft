// Il Motore Creativo ha un foglio di stile suo (scuro, con nomi di classe che
// coincidono con quelli del resto del prodotto: .kpi, .chip, th…). Per questo
// vive nel Pages Router: qui dentro vale SOLO il suo CSS, e il layout dell'app
// (app/layout.js con i fogli di LyftAI) non lo tocca. La tab «Motore Creativo»
// lo mostra in una cornice.
import '../lib/motore/ui/motore.css'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
