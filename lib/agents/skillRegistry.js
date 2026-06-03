import fs from 'fs'
import path from 'path'

// ─────────────────────────────────────────────────────────────
//  Skill Registry condiviso per tutti gli agent LyftAI.
//
//  Schema skill (stesso della install Claude Code):
//    lib/agents/skills/<name>/SKILL.md
//
//  Con frontmatter YAML:
//    ---
//    name: skill-name
//    description: "When the user wants ... Trigger phrases: ..."
//    metadata:
//      version: 1.0.0
//      category: meta|klaviyo|shopify|...
//      inputs: ...
//      outputs: ...
//    ---
//
//  L'agent fa match sul messaggio utente vs le `description` delle
//  skill e decide quali attivare nel proprio system prompt.
// ─────────────────────────────────────────────────────────────

const SKILLS_DIR = path.join(process.cwd(), 'lib', 'agents', 'skills')

let _cache = null

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { meta: {}, body: content }
  const yaml = m[1]
  const body = m[2].trim()
  const meta = parseSimpleYaml(yaml)
  return { meta, body }
}

// Mini-YAML parser per i nostri frontmatter (no deps esterne).
// Supporta: scalars, nested objects 1 livello, liste.
function parseSimpleYaml(yaml) {
  const obj = {}
  const lines = yaml.split('\n')
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    if (!raw.trim() || raw.trim().startsWith('#')) { i++; continue }
    const indent = raw.match(/^(\s*)/)[1].length
    if (indent === 0) {
      const m = raw.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/)
      if (!m) { i++; continue }
      const key = m[1]
      const val = m[2].trim()
      if (val === '') {
        // Nested object o lista
        const child = {}
        const items = []
        i++
        while (i < lines.length) {
          const sub = lines[i]
          if (!sub.trim()) { i++; continue }
          const subIndent = sub.match(/^(\s*)/)[1].length
          if (subIndent <= 0) break
          if (sub.trim().startsWith('- ')) {
            items.push(sub.trim().slice(2).trim().replace(/^["']|["']$/g, ''))
            i++
          } else {
            const sm = sub.trim().match(/^([a-zA-Z_][\w-]*):\s*(.*)$/)
            if (sm) child[sm[1]] = stripQuotes(sm[2])
            i++
          }
        }
        obj[key] = items.length > 0 ? items : child
      } else {
        obj[key] = stripQuotes(val)
        i++
      }
    } else {
      i++
    }
  }
  return obj
}

function stripQuotes(s) {
  return s.replace(/^["']|["']$/g, '')
}

// Carica tutte le skill da disco (cached in-process).
export function loadSkills() {
  if (_cache) return _cache
  try {
    if (!fs.existsSync(SKILLS_DIR)) {
      _cache = []
      return _cache
    }
    const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
    const skills = []
    for (const name of dirs) {
      const file = path.join(SKILLS_DIR, name, 'SKILL.md')
      if (!fs.existsSync(file)) continue
      try {
        const content = fs.readFileSync(file, 'utf8')
        const { meta, body } = parseFrontmatter(content)
        skills.push({
          name: meta.name || name,
          description: meta.description || '',
          version: meta.metadata?.version || '0.0.0',
          category: meta.metadata?.category || 'general',
          body,
          path: `lib/agents/skills/${name}/SKILL.md`,
        })
      } catch (e) {
        console.log('[skillRegistry] failed to load', name, e?.message)
      }
    }
    _cache = skills
    return _cache
  } catch (e) {
    console.log('[skillRegistry] load failed', e?.message)
    _cache = []
    return _cache
  }
}

export function listSkills() {
  return loadSkills().map(s => ({
    name: s.name,
    description: s.description,
    version: s.version,
    category: s.category,
  }))
}

export function getSkill(name) {
  return loadSkills().find(s => s.name === name) || null
}

// Match contestuale: tokenizza il messaggio utente e cerca skill con
// trigger phrases o keyword overlap nella description.
// Ritorna le skill ordinate per score discendente.
export function matchSkillsForContext(userMessage, { limit = 3, minScore = 1 } = {}) {
  const text = String(userMessage || '').toLowerCase()
  if (!text.trim()) return []

  const skills = loadSkills()
  const scored = skills.map(s => {
    const desc = String(s.description || '').toLowerCase()
    // Estrai le trigger phrases tra apici singoli/doppi nella description.
    const triggers = [...desc.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
    let score = 0
    for (const trig of triggers) {
      if (trig.length >= 3 && text.includes(trig)) score += 2
    }
    // Bonus se la skill name e' citata.
    if (text.includes(s.name)) score += 3
    // Bonus se la category appare.
    if (text.includes(s.category)) score += 1
    return { skill: s, score }
  })

  return scored
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.skill)
}

// Forza ricarica (utile in dev).
export function reloadSkills() {
  _cache = null
  return loadSkills()
}
