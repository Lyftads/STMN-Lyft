// Mappa: id agente squadra → id agent ElevenLabs Conversational AI (v2 multi-voce).
// Ogni agente ha la sua VOCE e regole di transfer verso i colleghi (consultazione
// in call con voci diverse). Provisionati via API (vedi memoria project_lyft_ai_team).
export const CALL_AGENTS = {
  ceo: 'agent_7001ktpghyckfsn8e78z888xaw6g',       // Chiara
  cfo: 'agent_5801ktpncmk6e8mt3kzpfrpw8b2t',       // Marco
  cmo: 'agent_1301ktpncnzee9j8ppdp6nf50b89',       // Luigi
  ads: 'agent_2001ktpncrr4f1a935nrkrjvyvhe',       // Sofia
  seo: 'agent_6101ktpncsynfca83jkwgbg95q5t',       // Davide
  cro: 'agent_6601ktpncv4jftes3arj8mqr7zkc',       // Giulia
  data: 'agent_1801ktpncwm4e8stf36deneh6vjd',      // Alessandro
  creative: 'agent_2701ktpncxsge8atgzzv7z17yk5a',  // Valentina
}

export function getCallAgentId(agentId) {
  return CALL_AGENTS[agentId] || process.env.ELEVENLABS_AGENT_ID || CALL_AGENTS.ceo
}
