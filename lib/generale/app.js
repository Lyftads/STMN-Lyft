// La «Dashboard generale» (/generale) mette insieme tutti i clienti dell'agenzia.
// Alcuni clienti hanno un'app loro, con regole loro (marketplace fuori dal fatturato,
// campagne per i negozi fisici fuori dalla spesa): i loro numeri si leggono DA LI', cosi'
// la generale mostra le stesse cifre che il cliente vede a casa sua.
// Tutti gli altri si leggono da questa app, sul loro workspace.
// Per un cliente con un'app nuova basta una riga.
export const APP_DEDICATE = {
  'd41c50ab-6c54-467b-a890-72cc77425ad6': 'https://annavirgili.lyftai.io',     // Anna Virgili
  '1605180d-4e94-43bb-bb68-f0083b30c8df': 'https://dude21.lyftai.io',          // Dude 21
  '356593e7-3c04-4f7f-80b8-1a41765d53ac': 'https://bottegadalmut.lyftai.io',   // Bottega Dalmut
}

// Chi puo' aprire la Dashboard generale: SOLO il titolare dell'agenzia (Marino).
// Non e' una funzione del prodotto: e' la sua pagina, con un indirizzo a parte.
// GENERALE_UTENTI (id separati da virgola) la apre ad altri senza toccare il codice.
export const CHI_PUO = (process.env.GENERALE_UTENTI || 'd02d82e5-de6b-455e-9633-ba5bb864a5c2').split(',').map(x => x.trim()).filter(Boolean)
