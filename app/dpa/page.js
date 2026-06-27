'use client'

import Link from 'next/link'
import { useI18n } from '../../lib/i18n/I18nProvider'

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'

const h2 = { fontSize: 21, fontWeight: 800, marginTop: 38, marginBottom: 10, color: '#fff', letterSpacing: '-0.01em' }
const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 18px', margin: '12px 0' }

// Pagina pubblica — Data Processing Agreement (Accordo sul trattamento dei dati,
// art. 28 GDPR) tra il merchant (Titolare) e Lyft SRL (Responsabile).
// ⚠️ BOZZA da far validare a un legale prima del go-live.
export default function DPA() {
  const { t } = useI18n()
  const updated = '27/6/2026'
  return (
    <main style={{
      minHeight: '100vh', background: '#000', color: 'rgba(255,255,255,0.78)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      lineHeight: 1.7, fontSize: 15, position: 'relative', overflowX: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: -160, left: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -180, right: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${BLUE}2e, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', background: `linear-gradient(90deg,#fff,${ACCENT} 60%,${BLUE})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>LyftAI</span>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13.5 }}>{t('legal.backToSite', null, '← Back to site')}</Link>
        </div>

        <div style={{ padding: '40px 0 80px' }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>{t('dpa.title', null, 'Data Processing Agreement (DPA)')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5, marginBottom: 8 }}>{t('dpa.updated', null, 'Last updated:')} {updated}</p>
          <p>{t('dpa.intro', null, 'This Data Processing Agreement (“DPA”) governs the processing of personal data carried out by Lyft SRL (“Processor”) on behalf of the customer/merchant who uses LyftAI (“Controller”), pursuant to Article 28 of Regulation (EU) 2016/679 (“GDPR”). It forms an integral part of the Terms of Service.')}</p>

          <h2 style={h2}>{t('dpa.h1', null, '1. Parties')}</h2>
          <p><strong style={{ color: '#fff' }}>{t('dpa.processor', null, 'Processor')}:</strong> LYFT SRL — Via Corso Giuseppe Mazzini 223, San Benedetto del Tronto (AP) 63074 — P. IVA IT02600730440 — <a href="mailto:info@lyftads.agency" style={{ color: BLUE }}>info@lyftads.agency</a>.</p>
          <p><strong style={{ color: '#fff' }}>{t('dpa.controller', null, 'Controller')}:</strong> {t('dpa.controllerDesc', null, 'the merchant/customer who connects their data sources and uses the LyftAI service.')}</p>

          <h2 style={h2}>{t('dpa.h2', null, '2. Subject matter, duration, nature and purpose')}</h2>
          <p>{t('dpa.p2', null, 'The Processor processes personal data only to provide the LyftAI features requested by the Controller (analytics dashboards, KPIs, reports, attribution, LTV/cohorts, customer segmentation, AI assistants), for the duration of the service and the Controller’s instructions, which coincide with the use of the platform.')}</p>

          <h2 style={h2}>{t('dpa.h3', null, '3. Types of data and categories of data subjects')}</h2>
          <p>{t('dpa.p3', null, 'Data accessed via the Controller’s connected platforms: order and sales data, aggregated customer metrics (order count, spend, dates), and — where the Controller’s app is authorized — customer identifiers (name, email) for segmentation and merchant-initiated campaigns. Data subjects: the Controller’s own end customers and the Controller’s authorized users.')}</p>

          <h2 style={h2}>{t('dpa.h4', null, '4. Processor obligations')}</h2>
          <ul>
            <li>{t('dpa.o1', null, 'Process personal data only on documented instructions from the Controller (use of the platform), unless required by law.')}</li>
            <li>{t('dpa.o2', null, 'Ensure persons authorized to process data are bound by confidentiality.')}</li>
            <li>{t('dpa.o3', null, 'Implement appropriate technical and organizational security measures (TLS in transit, encryption at rest, per-tenant isolation via Row-Level Security, least-privilege read-only scopes, PII removed before any AI processing).')}</li>
            <li>{t('dpa.o4', null, 'Assist the Controller in responding to data subject requests and in ensuring compliance (security, breach notification, DPIA).')}</li>
            <li>{t('dpa.o5', null, 'Make available the information necessary to demonstrate compliance and allow for audits.')}</li>
          </ul>

          <h2 style={h2}>{t('dpa.h5', null, '5. Sub-processors')}</h2>
          <p>{t('dpa.p5', null, 'The Controller authorizes the Processor to engage the sub-processors listed in our Privacy Policy (e.g. Vercel, Supabase, Nango, OpenAI, Stripe, Resend and others). The Processor imposes on each sub-processor data-protection obligations equivalent to those of this DPA and remains responsible for their performance. The updated list is available in the')} <Link href="/privacy" style={{ color: BLUE }}>{t('dpa.privacyLink', null, 'Privacy Policy')}</Link>.</p>

          <h2 style={h2}>{t('dpa.h6', null, '6. Data subject rights')}</h2>
          <p>{t('dpa.p6', null, 'Taking into account the nature of the processing, the Processor assists the Controller with appropriate technical and organizational measures, insofar as possible, in fulfilling the Controller’s obligation to respond to requests to exercise data subject rights (access, rectification, erasure, restriction, portability, objection). Shopify compliance webhooks (customers/data_request, customers/redact, shop/redact) are implemented.')}</p>

          <h2 style={h2}>{t('dpa.h7', null, '7. Personal data breach')}</h2>
          <p>{t('dpa.p7', null, 'The Processor notifies the Controller without undue delay after becoming aware of a personal data breach affecting the Controller’s data, providing the information needed for the Controller’s own notification obligations.')}</p>

          <h2 style={h2}>{t('dpa.h8', null, '8. Return and deletion')}</h2>
          <p>{t('dpa.p8', null, 'At the Controller’s choice, upon termination of the service the Processor deletes or returns the personal data and deletes existing copies, unless retention is required by law. The Controller can disconnect any platform at any time, revoking access and tokens. Account holders can export or delete their data from Settings → Privacy and data.')}</p>

          <h2 style={h2}>{t('dpa.h9', null, '9. International transfers')}</h2>
          <p>{t('dpa.p9', null, 'Where personal data is transferred outside the EEA (e.g. to sub-processors hosted in the United States), such transfers are based on appropriate safeguards, including the European Commission’s Standard Contractual Clauses (SCCs) and supplementary measures where required.')}</p>

          <h2 style={h2}>{t('dpa.h10', null, '10. Contacts')}</h2>
          <p>{t('dpa.p10', null, 'For any request related to this DPA:')} <a href="mailto:info@lyftads.agency" style={{ color: BLUE }}>info@lyftads.agency</a>.</p>

          <div style={card}>{t('dpa.signNote', null, 'By using the LyftAI service, the Controller accepts this DPA. A countersigned copy can be requested by writing to info@lyftads.agency.')}</div>

          <p style={{ marginTop: 46, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{t('legal.draftNote', null, 'This document is a technical draft and must be validated by a legal advisor before final publication.')}</p>
        </div>
      </div>
    </main>
  )
}
