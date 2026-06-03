export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { listSkills, getSkill, matchSkillsForContext } from '../../../../lib/agents/skillRegistry'

// ─────────────────────────────────────────────────────────────
//  /api/agents/skills
//   GET                         → lista tutte le skill installate
//   GET ?name=<skill-name>      → dettaglio skill (body incluso)
//   GET ?match=<user-message>   → skill matchate dal contesto
// ─────────────────────────────────────────────────────────────

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  const match = searchParams.get('match')

  if (name) {
    const skill = getSkill(name)
    if (!skill) return NextResponse.json({ error: 'Skill non trovata' }, { status: 404 })
    return NextResponse.json({ skill })
  }

  if (match) {
    const matched = matchSkillsForContext(match, { limit: 3 })
    return NextResponse.json({
      query: match,
      matched: matched.map(s => ({
        name: s.name,
        description: s.description,
        category: s.category,
        version: s.version,
      })),
    })
  }

  const skills = listSkills()
  return NextResponse.json({
    count: skills.length,
    skills,
  })
}
