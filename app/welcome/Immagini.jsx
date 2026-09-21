// Un'immagine del prodotto, nei due temi: foto della demo a 1920×1200, una serie per lingua e
// per tema (<id>.webp di giorno, <id>-scuro.webp di notte). Si vede quella del tema scelto; sono
// tutte pigre, e quella nascosta non si scarica.
import s from './landing.module.css'

export default function Immagini({ lang, id, alt, className }) {
  return (
    <>
      <img src={`/landing/${lang}/${id}.webp`} alt={alt} width={1920} height={1200} loading="lazy" decoding="async" className={`${s.soloChiaro} ${className || ''}`} />
      <img src={`/landing/${lang}/${id}-scuro.webp`} alt={alt} width={1920} height={1200} loading="lazy" decoding="async" className={`${s.soloScuro} ${className || ''}`} />
    </>
  )
}
