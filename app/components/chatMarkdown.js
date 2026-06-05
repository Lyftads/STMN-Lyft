// Rendering markdown minimale e sicuro per i messaggi chat.
// Escapa l'HTML, poi applica formattazione base (bold/italic/strike/code/link/lista).
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderMarkdown(text) {
  let s = esc(text)
  // code inline `...`
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:5px;font-family:ui-monospace,monospace;font-size:0.9em">$1</code>')
  // bold **...**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  // strike ~~...~~
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  // italic _..._
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1<i>$2</i>')
  // link automatici
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#7b9cff;text-decoration:underline">$1</a>')
  // menzioni @nome
  s = s.replace(/(^|\s)@([\w.\-]+)/g, '$1<span style="color:#9db4ff;font-weight:600">@$2</span>')
  // elenco puntato e a capo
  s = s.replace(/(^|<br>)\s*-\s+(.+?)(?=<br>|$)/g, '$1• $2')
  s = s.replace(/\n/g, '<br>')
  return s
}
