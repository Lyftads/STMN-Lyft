import { getServerSupabase } from '../supabase/server'

// Utente loggato corrente (auth). Ritorna { id, email } o null.
// Stava in lib/studio/credits.js: quando Creative Studio e il sistema crediti
// sono stati eliminati, tre route VIVE (trascrizione vocale di LyftTalk, voce
// e signed-url delle call) dipendevano ancora da quel file solo per questo
// helper. Spostato qui, dove non dipende da una feature rimossa.
export async function getAuthUser() {
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    return { id: user.id, email: user.email }
  } catch {
    return null
  }
}
