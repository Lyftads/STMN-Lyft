// Google Drive Picker (client-side). Apre il selettore ufficiale dei file Drive
// dell'utente, ottiene un access token con scope drive.readonly via Google
// Identity Services, e ritorna i file scelti. Nessuna copia: si usa il
// riferimento Drive (id + url + thumbnail). Richiede:
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID  (OAuth client id)
//   NEXT_PUBLIC_GOOGLE_PICKER_KEY (API key, Picker/Drive API abilitate)

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src; s.async = true; s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`load failed: ${src}`))
    document.head.appendChild(s)
  })
}

export function drivePickerConfigured() {
  return !!(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_PICKER_KEY)
}

export async function openDrivePicker(onPick) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_KEY
  if (!clientId || !apiKey) throw new Error('Drive Picker non configurato')

  await loadScript('https://accounts.google.com/gsi/client')
  await loadScript('https://apis.google.com/js/api.js')
  await new Promise((res) => window.gapi.load('picker', res))

  const token = await new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp) => (resp && resp.access_token ? resolve(resp.access_token) : reject(new Error('Autorizzazione Drive negata'))),
    })
    tc.requestAccessToken()
  })

  const g = window.google
  const view = new g.picker.DocsView(g.picker.ViewId.DOCS)
    .setMimeTypes('image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/x-m4v')
    .setSelectFolderEnabled(false)

  const picker = new g.picker.PickerBuilder()
    .setOAuthToken(token)
    .setDeveloperKey(apiKey)
    .addView(view)
    .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
    .setCallback((data) => {
      if (data.action !== g.picker.Action.PICKED) return
      const files = (data.docs || []).map((d) => ({
        id: d.id,
        name: d.name,
        mimeType: d.mimeType || '',
        url: `https://drive.google.com/uc?export=download&id=${d.id}`,
        thumbnail: (d.thumbnails && d.thumbnails.length ? d.thumbnails[d.thumbnails.length - 1].url : null),
      }))
      onPick(files, token)
    })
    .build()
  picker.setVisible(true)
}
