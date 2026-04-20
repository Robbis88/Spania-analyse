'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
)

const PASSORD = 'Isabella26'

type Melding = { role: 'user' | 'assistant'; content: string }
type Oppgave = { id: string; tittel: string; ansvar: string; prioritet: 'hast' | 'normal' | 'lav'; status: 'aktiv' | 'ferdig'; frist: string; opprettet: string }
type Prosjekt = {
  id: string; bruker: string; navn: string; status: string; dato_kjopt: string
  kategori: 'flipp' | 'utleie'
  kjøpesum: number; kjøpskostnader: number; oppussingsbudsjett: number; oppussing_faktisk: number
  møblering: number; forventet_salgsverdi: number; leieinntekt_mnd: number; lån_mnd: number
  fellesutgifter_mnd: number; strøm_mnd: number; forsikring_mnd: number; forvaltning_mnd: number
  notater: string; måneder: { måned: string; inntekt: number; kostnad: number; notat: string }[]
}

const tomtProsjekt = (): Prosjekt => ({
  id: Date.now().toString(), bruker: 'leganger', navn: '', status: 'Under vurdering',
  kategori: 'utleie',
  dato_kjopt: '', kjøpesum: 0, kjøpskostnader: 0, oppussingsbudsjett: 0, oppussing_faktisk: 0,
  møblering: 0, forventet_salgsverdi: 0, leieinntekt_mnd: 0, lån_mnd: 0, fellesutgifter_mnd: 0,
  strøm_mnd: 0, forsikring_mnd: 0, forvaltning_mnd: 0, notater: '', måneder: []
})

function beregnEffektivPrioritet(o: Oppgave): 'hast' | 'normal' | 'lav' {
  if (o.status === 'ferdig') return o.prioritet
  if (!o.frist) return o.prioritet
  const idag = new Date(); idag.setHours(0, 0, 0, 0)
  const frist = new Date(o.frist); frist.setHours(0, 0, 0, 0)
  const dager = Math.ceil((frist.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))
  if (o.prioritet === 'hast') return 'hast'
  if (o.prioritet === 'normal') return dager <= 1 ? 'hast' : 'normal'
  if (o.prioritet === 'lav') return dager <= 1 ? 'hast' : dager <= 2 ? 'normal' : 'lav'
  return o.prioritet
}

function fristTekst(frist: string): string {
  if (!frist) return ''
  const idag = new Date(); idag.setHours(0, 0, 0, 0)
  const fristDato = new Date(frist); fristDato.setHours(0, 0, 0, 0)
  const dager = Math.ceil((fristDato.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))
  if (dager < 0) return `⚠️ ${Math.abs(dager)} dag${Math.abs(dager) !== 1 ? 'er' : ''} over frist`
  if (dager === 0) return '🔴 Frist i dag!'
  if (dager === 1) return '🔴 Frist i morgen'
  if (dager === 2) return '🟡 Frist om 2 dager'
  return `📅 Frist om ${dager} dager`
}

const prioritetFarge = (ep: string, status: string) => {
  if (status === 'ferdig') return { bg: '#e8f5ed', border: '#2D7D46', color: '#2D7D46' }
  if (ep === 'hast') return { bg: '#fde8ec', border: '#C8102E', color: '#C8102E' }
  if (ep === 'normal') return { bg: '#fff8e1', border: '#B05E0A', color: '#B05E0A' }
  return { bg: '#f8f8f8', border: '#ddd', color: '#666' }
}

const prioritetLabel = (ep: string) => ep === 'hast' ? '🔴 Hast' : ep === 'normal' ? '🟡 Normal' : '⚪ Lav'

const statusFarge = (s: string) => {
  if (s === 'Utleie') return { bg: '#e8f5ed', color: '#2D7D46' }
  if (s === 'Kjøpt') return { bg: '#f0f7ff', color: '#185FA5' }
  if (s === 'Under oppussing') return { bg: '#fff8e1', color: '#B05E0A' }
  if (s === 'Solgt') return { bg: '#f0f0f0', color: '#666' }
  return { bg: '#fde8ec', color: '#C8102E' }
}

const inputStyle = { width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'sans-serif' }
const selectStyle = { width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd' }
const labelStyle = { fontSize: 12, color: '#666', marginBottom: 5, display: 'block' as const }
const fieldStyle = { display: 'flex', flexDirection: 'column' as const }

function ProsjektFelter({ data, onChange }: { data: Prosjekt, onChange: (p: Prosjekt) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
      {[
        { key: 'navn', lbl: 'Prosjektnavn', placeholder: 'F.eks. Villa Marbella', type: 'text' },
        { key: 'dato_kjopt', lbl: 'Dato kjøpt', placeholder: '', type: 'date' },
        { key: 'kjøpesum', lbl: 'Kjøpesum (€)', placeholder: '650000', type: 'number' },
        { key: 'kjøpskostnader', lbl: 'Kjøpskostnader (€)', placeholder: '84500', type: 'number' },
        { key: 'oppussingsbudsjett', lbl: 'Oppussingsbudsjett (€)', placeholder: '50000', type: 'number' },
        { key: 'oppussing_faktisk', lbl: 'Oppussing faktisk (€)', placeholder: '0', type: 'number' },
        { key: 'møblering', lbl: 'Møblering (€)', placeholder: '15000', type: 'number' },
        { key: 'forventet_salgsverdi', lbl: 'Forventet salgsverdi (€)', placeholder: '800000', type: 'number' },
        { key: 'leieinntekt_mnd', lbl: 'Leieinntekt/mnd (€)', placeholder: '3000', type: 'number' },
        { key: 'lån_mnd', lbl: 'Lånebetaling/mnd (€)', placeholder: '2000', type: 'number' },
        { key: 'fellesutgifter_mnd', lbl: 'Fellesutgifter/mnd (€)', placeholder: '200', type: 'number' },
        { key: 'strøm_mnd', lbl: 'Strøm/mnd (€)', placeholder: '100', type: 'number' },
        { key: 'forsikring_mnd', lbl: 'Forsikring/mnd (€)', placeholder: '80', type: 'number' },
        { key: 'forvaltning_mnd', lbl: 'Forvaltning/mnd (€)', placeholder: '150', type: 'number' },
      ].map((f, i) => (
        <div key={i} style={fieldStyle}>
          <label style={labelStyle}>{f.lbl}</label>
          <input style={inputStyle} type={f.type} value={(data as any)[f.key] || ''} onChange={e => onChange({ ...data, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} placeholder={f.placeholder} />
        </div>
      ))}
      <div style={fieldStyle}>
        <label style={labelStyle}>Kategori</label>
        <select style={selectStyle} value={data.kategori} onChange={e => onChange({ ...data, kategori: e.target.value as 'flipp' | 'utleie' })}>
          <option value="utleie">🏖️ Utleie</option>
          <option value="flipp">🔨 Flipp</option>
        </select>
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Status</label>
        <select style={selectStyle} value={data.status} onChange={e => onChange({ ...data, status: e.target.value })}>
          {['Under vurdering', 'Kjøpt', 'Under oppussing', 'Utleie', 'Solgt'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Notater</label>
        <textarea value={data.notater} onChange={e => onChange({ ...data, notater: e.target.value })} placeholder="F.eks. Kontakt: Maria Lopez, advokat..."
          style={{ width: '100%', height: 80, padding: 12, fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', resize: 'vertical', fontFamily: 'sans-serif' }} />
      </div>
    </div>
  )
}

function ScoreKort({ s }: { s: any }) {
  const fmt = (n: number) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'
  return (
    <div style={{ background: s.lys === '🟢' ? '#e8f5ed' : s.lys === '🟡' ? '#fff8e1' : '#fde8ec', border: `2px solid ${s.lys === '🟢' ? '#2D7D46' : s.lys === '🟡' ? '#B05E0A' : '#C8102E'}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 56 }}>{s.lys}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.lys === '🟢' ? '#1a4d2b' : s.lys === '🟡' ? '#6b3a0a' : '#7a0c1e' }}>{s.lysTekst}</div>
          <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{s.lysInfo}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: s.lys === '🟢' ? '#1a4d2b' : s.lys === '🟡' ? '#6b3a0a' : '#7a0c1e' }}>{s.total}</div>
          <div style={{ fontSize: 12, color: '#888' }}>/ 10</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { lbl: '📍 Lokasjon', val: s.lokasjon }, { lbl: '🏠 Eiendom', val: s.eiendom },
          { lbl: '💰 Pris vs marked', val: s.pris_vs_marked }, { lbl: '📈 Airbnb', val: s.airbnb_potensial },
          { lbl: '💸 Cashflow', val: s.cashflow }, { lbl: '🔨 Oppussing', val: s.oppussing_potensial },
          { lbl: '⚠️ Risiko', val: s.risiko },
        ].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#B05E0A' : '#C8102E' }}>{item.val}</div>
            <div style={{ background: '#e0e0e0', borderRadius: 3, height: 4, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ width: `${item.val * 10}%`, height: 4, background: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#EF9F27' : '#C8102E', borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[{ lbl: 'Brutto år 1', val: fmt(s.brutto_ar1) }, { lbl: 'Brutto etablert', val: fmt(s.brutto_etablert) }, { lbl: 'Netto estimat', val: fmt(s.netto_estimat) }].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2D7D46' }}>{item.val}</div>
          </div>
        ))}
      </div>
      {(s.maks_oppussing_5pst > 0 || s.maks_oppussing_6pst > 0 || s.maks_oppussing_7pst > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🔨 Maks oppussingsbudsjett</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[{ lbl: 'Ved 5% yield', val: s.maks_oppussing_5pst }, { lbl: 'Ved 6% yield', val: s.maks_oppussing_6pst }, { lbl: 'Ved 7% yield', val: s.maks_oppussing_7pst }].map((item, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.val > 0 ? '#2D7D46' : '#C8102E' }}>{fmt(item.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.tips && s.tips.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💡 Hva må til for grønn?</div>
          {s.tips.map((t: string, i: number) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>→ {t}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [loggetInn, setLoggetInn] = useState(false)
  const [passordInput, setPassordInput] = useState('')
  const [passordFeil, setPassordFeil] = useState(false)
  const [aktivSeksjon, setAktivSeksjon] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [airbnbLoading, setAirbnbLoading] = useState(false)
  const [airbnbAnalyse, setAirbnbAnalyse] = useState('')
  const [airbnbScore, setAirbnbScore] = useState<any>(null)
  const [visSkjema, setVisSkjema] = useState(false)
  const [lagreMelding, setLagreMelding] = useState('')
  const [bolig, setBolig] = useState({
    type: '', beliggenhet: '', soverom: '', bad: '', areal: '', avstand_strand: '',
    basseng: 'felles', parkering: 'privat', havutsikt: 'nei', standard: 'moderne',
    pris: '', ekstra: '', markedspris_bra_m2: '', oppbudsjett: ''
  })
  const [prosjekter, setProsjekter] = useState<Prosjekt[]>([])
  const [dbLoading, setDbLoading] = useState(false)
  const [nyttProsjekt, setNyttProsjekt] = useState<Prosjekt>(tomtProsjekt())
  const [visNyttSkjema, setVisNyttSkjema] = useState(false)
  const [nyMåned, setNyMåned] = useState({ måned: '', inntekt: 0, kostnad: 0, notat: '' })
  const [visProsjekt, setVisProsjekt] = useState<string | null>(null)
  const [redigerProsjekt, setRedigerProsjekt] = useState<Prosjekt | null>(null)
  const [aktivTab, setAktivTab] = useState<'oversikt' | 'arsrapport'>('oversikt')
  const [valgtAr, setValgtAr] = useState(new Date().getFullYear())
  const [oppgaver, setOppgaver] = useState<Oppgave[]>([])
  const [nyTittel, setNyTittel] = useState('')
  const [nyAnsvar, setNyAnsvar] = useState('')
  const [nyPrioritet, setNyPrioritet] = useState<'hast' | 'normal' | 'lav'>('normal')
  const [nyFrist, setNyFrist] = useState('')
  const [visNyOppgave, setVisNyOppgave] = useState(false)
  const [agentApen, setAgentApen] = useState(false)
  const [meldinger, setMeldinger] = useState<Melding[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const chatBunnRef = useRef<HTMLDivElement>(null)

  // Salgsverktøy state
  const [selgBolig, setSelgBolig] = useState<string | null>(null)
  const [salgInput, setSalgInput] = useState({
    salgspris: 0,
    megler_pst: 5,
    advokat_pst: 1,
    plusvalia: 0,
    skatteresidens: 'eu' as 'eu' | 'ikke_eu',
    ventetid_ar: 0,
  })
  const [markedsprisLoading, setMarkedsprisLoading] = useState(false)
  const [markedsprisData, setMarkedsprisData] = useState<any>(null)

  useEffect(() => { if (loggetInn) hentOppgaver() }, [loggetInn])
  useEffect(() => {
    if (loggetInn && (aktivSeksjon === 'regnskap' || aktivSeksjon === 'flipp' || aktivSeksjon === 'utleie' || aktivSeksjon === 'selge')) {
      hentProsjekter()
    }
  }, [loggetInn, aktivSeksjon])
  useEffect(() => { chatBunnRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger])

  async function sendAgentMelding() {
    if (!agentInput.trim() || agentLoading) return
    const nyeMeldinger: Melding[] = [...meldinger, { role: 'user', content: agentInput }]
    setMeldinger(nyeMeldinger); setAgentInput(''); setAgentLoading(true)
    try {
      const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meldinger: nyeMeldinger }) })
      const data = await res.json()
      setMeldinger([...nyeMeldinger, { role: 'assistant', content: data.svar }])
    } catch {
      setMeldinger([...nyeMeldinger, { role: 'assistant', content: 'Beklager, noe gikk galt.' }])
    }
    setAgentLoading(false)
  }

  async function hentOppgaver() {
    const { data } = await supabase.from('oppgaver').select('*').order('opprettet', { ascending: false })
    if (data) {
      const sortert = [...data].sort((a, b) => {
        if (a.status === 'ferdig' && b.status !== 'ferdig') return 1
        if (a.status !== 'ferdig' && b.status === 'ferdig') return -1
        const pr = { hast: 0, normal: 1, lav: 2 }
        return pr[beregnEffektivPrioritet(a as Oppgave)] - pr[beregnEffektivPrioritet(b as Oppgave)]
      })
      setOppgaver(sortert as Oppgave[])
    }
  }

  async function leggTilOppgave() {
    if (!nyTittel) return
    await supabase.from('oppgaver').insert([{ id: Date.now().toString(), tittel: nyTittel, ansvar: nyAnsvar, prioritet: nyPrioritet, frist: nyFrist, status: 'aktiv' }])
    setNyTittel(''); setNyAnsvar(''); setNyPrioritet('normal'); setNyFrist('')
    setVisNyOppgave(false); await hentOppgaver()
  }

  async function toggleOppgave(o: Oppgave) {
    await supabase.from('oppgaver').update({ status: o.status === 'aktiv' ? 'ferdig' : 'aktiv' }).eq('id', o.id)
    await hentOppgaver()
  }

  async function slettOppgave(id: string) {
    await supabase.from('oppgaver').delete().eq('id', id)
    await hentOppgaver()
  }

  async function hentProsjekter() {
    setDbLoading(true)
    const { data } = await supabase.from('prosjekter').select('*').eq('bruker', 'leganger').order('opprettet', { ascending: false })
    if (data) setProsjekter(data)
    setDbLoading(false)
  }

  async function leggTilProsjekt() {
    if (!nyttProsjekt.navn) return
    await supabase.from('prosjekter').insert([{ ...nyttProsjekt, id: Date.now().toString(), bruker: 'leganger' }])
    await hentProsjekter(); setNyttProsjekt(tomtProsjekt()); setVisNyttSkjema(false)
  }

  async function lagreAnalyseSomProsjekt(kategori: 'flipp' | 'utleie') {
    if (!result) return
    const navn = result.tittel || result.beliggenhet || 'Analysert bolig'
    const nytt: Prosjekt = {
      ...tomtProsjekt(),
      id: Date.now().toString(),
      navn,
      kategori,
      status: kategori === 'flipp' ? 'Under vurdering' : 'Under vurdering',
      kjøpesum: Number(bolig.pris) || result.pris || 0,
      oppussingsbudsjett: Number(bolig.oppbudsjett) || 0,
      lån_mnd: result.mnd_betaling || 0,
      notater: `Lagret fra Boliganalyse ${new Date().toLocaleDateString('nb-NO')}\n\n` +
               `Type: ${bolig.type || result.type || '-'}\n` +
               `Beliggenhet: ${bolig.beliggenhet || result.beliggenhet || '-'}\n` +
               `Soverom: ${bolig.soverom || result.soverom || '-'}\n` +
               `Areal: ${bolig.areal || result.areal || '-'} m²\n` +
               (airbnbScore ? `\nScore: ${airbnbScore.total}/10 ${airbnbScore.lys}\n` : '') +
               (result.ai_vurdering ? `\nAI-vurdering: ${result.ai_vurdering}` : '')
    }
    const { error } = await supabase.from('prosjekter').insert([{ ...nytt, bruker: 'leganger' }])
    if (error) {
      setLagreMelding('❌ Feil ved lagring: ' + error.message)
    } else {
      setLagreMelding(`✅ Lagret som ${kategori === 'flipp' ? 'flipp-prosjekt' : 'utleieprosjekt'}! Finn det under "${kategori === 'flipp' ? 'Boligflipp' : 'Boligutleie'}" eller "Regnskap".`)
      await hentProsjekter()
    }
    setTimeout(() => setLagreMelding(''), 5000)
  }

  async function lagreRedigering() {
    if (!redigerProsjekt) return
    await supabase.from('prosjekter').update(redigerProsjekt).eq('id', redigerProsjekt.id)
    await hentProsjekter(); setRedigerProsjekt(null)
  }

  async function slettProsjekt(id: string) {
    if (!confirm('Er du sikker?')) return
    await supabase.from('prosjekter').delete().eq('id', id)
    await hentProsjekter()
    if (visProsjekt === id) setVisProsjekt(null)
  }

  async function oppdaterProsjekt(oppdatert: Prosjekt) {
    await supabase.from('prosjekter').update(oppdatert).eq('id', oppdatert.id)
    await hentProsjekter()
  }

  async function leggTilMåned(prosjektId: string) {
    if (!nyMåned.måned) return
    const p = prosjekter.find(p => p.id === prosjektId)
    if (!p) return
    await oppdaterProsjekt({ ...p, måneder: [...p.måneder, nyMåned] })
    setNyMåned({ måned: '', inntekt: 0, kostnad: 0, notat: '' })
  }

  async function lastNedPDF(p: Prosjekt, ar: number) {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const fmt2 = (n: number) => n ? 'EUR ' + Math.round(n).toLocaleString('nb-NO') : '-'

    const arsinntekt = p.måneder.filter(m => m.måned.startsWith(ar.toString())).reduce((s, m) => s + m.inntekt, 0)
    const arskostnadLogg = p.måneder.filter(m => m.måned.startsWith(ar.toString())).reduce((s, m) => s + m.kostnad, 0)
    const fastKostAr = (p.lån_mnd + p.fellesutgifter_mnd + p.strøm_mnd + p.forsikring_mnd + p.forvaltning_mnd) * 12
    const totalKost = arskostnadLogg + fastKostAr
    const netto = arsinntekt - totalKost
    const totInv = p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering

    doc.setFillColor(26, 26, 46)
    doc.rect(0, 0, 210, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Leganger Eiendom', 20, 15)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Arsrapport ' + ar + ' – ' + p.navn, 20, 25)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.text('Generert: ' + new Date().toLocaleDateString('nb-NO') + '  |  Status: ' + p.status + (p.dato_kjopt ? '  |  Kjøpt: ' + p.dato_kjopt : ''), 20, 42)

    let y = 52
    doc.setFillColor(240, 240, 255)
    doc.rect(15, y, 180, 8, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 46)
    doc.text('INVESTERING', 20, y + 5.5)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    const invRader = [
      ['Kjøpesum', fmt2(p.kjøpesum)],
      ['Kjøpskostnader', fmt2(p.kjøpskostnader)],
      ['Oppussing budsjett', fmt2(p.oppussingsbudsjett)],
      ['Oppussing faktisk', fmt2(p.oppussing_faktisk)],
      ['Møblering', fmt2(p.møblering)],
    ]
    invRader.forEach(([lbl, val], i) => {
      if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
      doc.text(lbl, 20, y + 2); doc.text(val, 190, y + 2, { align: 'right' }); y += 7
    })
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(230, 230, 250)
    doc.rect(15, y - 3, 180, 8, 'F')
    doc.text('Total investering', 20, y + 2); doc.text(fmt2(totInv), 190, y + 2, { align: 'right' })
    y += 14

    doc.setFillColor(230, 245, 237)
    doc.rect(15, y, 180, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 46)
    doc.setFontSize(11)
    doc.text('INNTEKTER ' + ar, 20, y + 5.5)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    const maneder = p.måneder.filter(m => m.måned.startsWith(ar.toString()))
    const manedNavn = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']
    if (maneder.length === 0) { doc.text('Ingen inntekter registrert for ' + ar, 20, y + 2); y += 7 }
    maneder.forEach((m, i) => {
      const mNr = parseInt(m.måned.split('-')[1]) - 1
      if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
      doc.text(manedNavn[mNr] + (m.notat ? ' – ' + m.notat : ''), 20, y + 2)
      doc.text(fmt2(m.inntekt), 190, y + 2, { align: 'right' }); y += 7
    })
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(45, 125, 70)
    doc.setTextColor(255, 255, 255)
    doc.rect(15, y - 3, 180, 8, 'F')
    doc.text('Sum inntekter', 20, y + 2); doc.text(fmt2(arsinntekt), 190, y + 2, { align: 'right' })
    doc.setTextColor(0, 0, 0); y += 14

    doc.setFillColor(253, 232, 236)
    doc.rect(15, y, 180, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 46)
    doc.setFontSize(11)
    doc.text('KOSTNADER ' + ar, 20, y + 5.5)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    const kostRader = [
      ['Lånebetaling (12 mnd)', fmt2(p.lån_mnd * 12)],
      ['Fellesutgifter (12 mnd)', fmt2(p.fellesutgifter_mnd * 12)],
      ['Strøm (12 mnd)', fmt2(p.strøm_mnd * 12)],
      ['Forsikring (12 mnd)', fmt2(p.forsikring_mnd * 12)],
      ['Forvaltning (12 mnd)', fmt2(p.forvaltning_mnd * 12)],
    ].filter(r => r[1] !== '-')
    if (arskostnadLogg > 0) kostRader.push(['Variable kostnader (logg)', fmt2(arskostnadLogg)])
    kostRader.forEach(([lbl, val], i) => {
      if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
      doc.text(lbl, 20, y + 2); doc.text(val, 190, y + 2, { align: 'right' }); y += 7
    })
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(200, 16, 46)
    doc.setTextColor(255, 255, 255)
    doc.rect(15, y - 3, 180, 8, 'F')
    doc.text('Sum kostnader', 20, y + 2); doc.text(fmt2(totalKost), 190, y + 2, { align: 'right' })
    doc.setTextColor(0, 0, 0); y += 14

    doc.setFillColor(netto >= 0 ? 45 : 200, netto >= 0 ? 125 : 16, netto >= 0 ? 70 : 46)
    doc.rect(15, y, 180, 40, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('RESULTAT ' + ar, 20, y + 10)
    doc.setFontSize(11)
    doc.text('Netto resultat:', 20, y + 20)
    doc.setFontSize(16)
    doc.text(fmt2(netto), 190, y + 20, { align: 'right' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Yield: ' + (totInv > 0 ? ((arsinntekt / totInv) * 100).toFixed(1) : '0') + '%  |  Total investert: ' + fmt2(totInv), 20, y + 32)

    doc.save(p.navn.replace(/\s/g, '_') + '_arsrapport_' + ar + '.pdf')
  }

  function loggInn() {
    if (passordInput === PASSORD) { setLoggetInn(true); setPassordFeil(false) }
    else setPassordFeil(true)
  }

  async function analyser() {
    setLoading(true); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setVisSkjema(false); setLagreMelding('')
    try {
      const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyText: input }) })
      const data = await res.json()
      setResult(data)
      setBolig({ type: data.type || '', beliggenhet: data.beliggenhet || '', soverom: data.soverom?.toString() || '', bad: '', areal: data.areal?.toString() || '', avstand_strand: data.avstand_strand_m?.toString() || '', basseng: 'felles', parkering: 'privat', havutsikt: 'nei', standard: data.bolig_standard || 'moderne', pris: data.pris?.toString() || '', ekstra: '', markedspris_bra_m2: data.markedspris_bra_m2?.toString() || '', oppbudsjett: '' })
      setVisSkjema(true)
    } catch { setResult({ ai_vurdering: 'Noe gikk galt, prøv igjen.' }) }
    setLoading(false)
  }

  async function kjørAirbnbAnalyse() {
    setAirbnbLoading(true); setAirbnbAnalyse(''); setAirbnbScore(null)
    try {
      const res = await fetch('/api/airbnb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bolig }) })
      const data = await res.json()
      setAirbnbAnalyse(data.analyse || ''); setAirbnbScore(data.score || null)
    } catch { setAirbnbAnalyse('Noe gikk galt, prøv igjen.') }
    setAirbnbLoading(false)
  }

  function nullstill() { setInput(''); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setVisSkjema(false); setLagreMelding('') }

  const fmt = (n: number) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'
  const fmtPct = (n: number) => n ? n.toFixed(1) + '%' : '–'
  const totalInvestering = (p: Prosjekt) => p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering
  const månedligKostnad = (p: Prosjekt) => p.lån_mnd + p.fellesutgifter_mnd + p.strøm_mnd + p.forsikring_mnd + p.forvaltning_mnd
  const månedligCashflow = (p: Prosjekt) => p.leieinntekt_mnd - månedligKostnad(p)
  const yield_pst = (p: Prosjekt) => totalInvestering(p) > 0 ? ((p.leieinntekt_mnd * 12) / totalInvestering(p) * 100) : 0
  const roi = (p: Prosjekt) => totalInvestering(p) > 0 ? ((p.forventet_salgsverdi - totalInvestering(p)) / totalInvestering(p) * 100) : 0

  // Filtrerte lister for de ulike seksjonene
  const flippProsjekter = prosjekter.filter(p => p.kategori === 'flipp')
  const utleieProsjekter = prosjekter.filter(p => p.kategori === 'utleie')
  const eideBoliger = prosjekter.filter(p => p.status !== 'Under vurdering' && p.status !== 'Solgt')

  if (!loggetInn) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f8', fontFamily: 'sans-serif' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏡</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Leganger Eiendom</h1>
            <p style={{ color: '#666', marginTop: 8, fontSize: 14 }}>Din partner for eiendomsinvestering i Spania</p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#666', marginBottom: 6, display: 'block' }}>Passord</label>
            <input type="password" value={passordInput} onChange={e => setPassordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loggInn()} placeholder="Skriv inn passord"
              style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 8, border: passordFeil ? '2px solid #C8102E' : '1.5px solid #ddd', fontFamily: 'sans-serif' }} />
            {passordFeil && <div style={{ color: '#C8102E', fontSize: 13, marginTop: 6 }}>Feil passord, prøv igjen.</div>}
          </div>
          <button onClick={loggInn} style={{ width: '100%', background: '#C8102E', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Logg inn</button>
        </div>
      </main>
    )
  }

  // Salgsberegninger
  function beregnSalg(p: Prosjekt, input: typeof salgInput) {
    const salgspris = input.salgspris || p.forventet_salgsverdi || 0
    const meglerBelop = salgspris * (input.megler_pst / 100)
    const advokatBelop = salgspris * (input.advokat_pst / 100)
    const salgskostnader = meglerBelop + advokatBelop

    // Kjøpskostnader er allerede registrert på prosjektet
    const totalKjop = p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk
    // Netto salgssum (før skatt)
    const nettoSalgssum = salgspris - salgskostnader
    // Kapitalgevinst (grunnlag for CGT)
    const kapitalgevinst = Math.max(0, nettoSalgssum - totalKjop)

    const cgtSats = input.skatteresidens === 'eu' ? 0.19 : 0.24
    const cgt = kapitalgevinst * cgtSats
    const retention3pst = salgspris * 0.03
    const differanseRetention = cgt - retention3pst // positiv = betale mer, negativ = få tilbakebetalt

    const totalSkatt = cgt + input.plusvalia
    const nettoILomma = nettoSalgssum - totalSkatt - (p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering)
    // Total fortjeneste etter alt
    const nettoFortjeneste = salgspris - salgskostnader - totalSkatt - p.kjøpesum - p.kjøpskostnader - p.oppussing_faktisk - p.møblering

    const totalInvestert = p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering
    const roiPst = totalInvestert > 0 ? (nettoFortjeneste / totalInvestert) * 100 : 0

    // Break-even: minste salgspris for å gå i null (før skatt)
    // nettoFortjeneste = salgspris - salgspris*(megler+advokat)/100 - CGT - plusvalia - totalInvestert = 0
    // Forenklet: hvis gevinst = 0, ingen CGT. Da trenger vi bare å dekke kostnader.
    const faktor = 1 - (input.megler_pst / 100) - (input.advokat_pst / 100)
    const breakEvenUtenGevinst = faktor > 0 ? (totalInvestert + input.plusvalia) / faktor : 0

    return {
      salgspris, meglerBelop, advokatBelop, salgskostnader, totalKjop,
      nettoSalgssum, kapitalgevinst, cgt, cgtSats, retention3pst, differanseRetention,
      totalSkatt, nettoFortjeneste, nettoILomma, totalInvestert, roiPst, breakEvenUtenGevinst,
    }
  }

  async function hentMarkedspris(p: Prosjekt) {
    setMarkedsprisLoading(true); setMarkedsprisData(null)
    try {
      const tekst = `Bolig i ${p.notater.includes('Beliggenhet:') ? (p.notater.split('Beliggenhet:')[1]?.split('\n')[0]?.trim() || p.navn) : p.navn}. Til salgs.`
      const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyText: tekst }) })
      const data = await res.json()
      setMarkedsprisData(data)
    } catch {
      setMarkedsprisData({ error: 'Kunne ikke hente markedspris' })
    }
    setMarkedsprisLoading(false)
  }

  async function markerSomSolgt(p: Prosjekt, salgspris: number) {
    if (!confirm(`Markere "${p.navn}" som solgt for €${salgspris.toLocaleString('nb-NO')}?`)) return
    await supabase.from('prosjekter').update({
      status: 'Solgt',
      forventet_salgsverdi: salgspris,
      notater: (p.notater || '') + `\n\n--- Solgt ${new Date().toLocaleDateString('nb-NO')} for €${salgspris.toLocaleString('nb-NO')} ---`
    }).eq('id', p.id)
    await hentProsjekter()
    setSelgBolig(null)
  }

  // Gjenbrukbar boligliste-komponent (brukes i Flipp, Utleie, Selge)
  function BoligListe({ liste, tomTekst, farge }: { liste: Prosjekt[]; tomTekst: string; farge: string }) {
    if (liste.length === 0) {
      return (
        <div style={{ background: '#f8f8f8', border: '2px dashed #ddd', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{tomTekst}</div>
          <div style={{ fontSize: 13 }}>Gå til Boliganalyse for å legge til en bolig</div>
        </div>
      )
    }
    return (
      <div>
        {liste.map(p => {
          const sf = statusFarge(p.status)
          return (
            <div key={p.id} style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{p.navn}</div>
                  <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                  {p.dato_kjopt && <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>Kjøpt: {p.dato_kjopt}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAktivSeksjon('regnskap'); setVisProsjekt(p.id) }} style={{ background: farge, color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Åpne</button>
                  <button onClick={() => slettProsjekt(p.id)} style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Slett</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Kjøpesum</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(p.kjøpesum)}</div>
                </div>
                <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Total investert</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(totalInvestering(p))}</div>
                </div>
                <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Kategori</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px', paddingBottom: 100 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏡</div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Leganger Eiendom</h1>
          <p style={{ color: '#666', marginTop: 8 }}>Din partner for eiendomsinvestering i Spania</p>
          <button onClick={() => { setLoggetInn(false); setAktivSeksjon(null) }} style={{ marginTop: 8, background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer' }}>Logg ut</button>
        </div>

        {!aktivSeksjon && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { id: 'analyse', emoji: '🔍', tittel: 'Boliganalyse', beskrivelse: 'Analyser en ny eiendom og vurder potensial', farge: '#C8102E', bg: '#fff5f5' },
                { id: 'flipp', emoji: '🔨', tittel: 'Boligflipp', beskrivelse: 'Dine flipp-prosjekter', farge: '#185FA5', bg: '#f0f7ff' },
                { id: 'utleie', emoji: '🏖️', tittel: 'Boligutleie', beskrivelse: 'Dine utleieboliger', farge: '#2D7D46', bg: '#f0faf4' },
                { id: 'selge', emoji: '💰', tittel: 'Selge bolig', beskrivelse: 'Verktøy for salg av eiendom', farge: '#B05E0A', bg: '#fff8e1' },
                { id: 'regnskap', emoji: '📊', tittel: 'Regnskap', beskrivelse: 'Oversikt over inntekter og kostnader', farge: '#7B2D8B', bg: '#f9f0ff' },
              ].map((boks, i) => (
                <div key={i} onClick={() => setAktivSeksjon(boks.id)}
                  style={{ background: boks.bg, border: `2px solid ${boks.farge}22`, borderRadius: 16, padding: 28, cursor: 'pointer', textAlign: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{boks.emoji}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: boks.farge, marginBottom: 8 }}>{boks.tittel}</div>
                  <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 16 }}>{boks.beskrivelse}</div>
                  <div style={{ background: boks.farge, color: 'white', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>Åpne →</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📋 Gjøremål</h2>
                <button onClick={() => setVisNyOppgave(!visNyOppgave)} style={{ background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Ny oppgave</button>
              </div>
              {visNyOppgave && (
                <div style={{ background: '#f8f8f8', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                    <div style={fieldStyle}><label style={labelStyle}>Oppgave</label><input style={inputStyle} value={nyTittel} onChange={e => setNyTittel(e.target.value)} placeholder="Hva skal gjøres?" onKeyDown={e => e.key === 'Enter' && leggTilOppgave()} /></div>
                    <div style={fieldStyle}><label style={labelStyle}>Ansvar</label><input style={inputStyle} value={nyAnsvar} onChange={e => setNyAnsvar(e.target.value)} placeholder="Hvem?" /></div>
                    <div style={fieldStyle}><label style={labelStyle}>Frist</label><input style={inputStyle} type="date" value={nyFrist} onChange={e => setNyFrist(e.target.value)} /></div>
                    <div style={fieldStyle}><label style={labelStyle}>Prioritet</label>
                      <select style={selectStyle} value={nyPrioritet} onChange={e => setNyPrioritet(e.target.value as any)}>
                        <option value="hast">🔴 Hast</option><option value="normal">🟡 Normal</option><option value="lav">⚪ Lav</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={leggTilOppgave} style={{ flex: 1, background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>✅ Legg til</button>
                    <button onClick={() => setVisNyOppgave(false)} style={{ background: '#f0f0f0', color: '#444', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>Avbryt</button>
                  </div>
                </div>
              )}
              {oppgaver.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa', fontSize: 14 }}>Ingen oppgaver ennå!</div>}
              {oppgaver.map(o => {
                const ep = beregnEffektivPrioritet(o)
                const pf = prioritetFarge(ep, o.status)
                const ft = o.status === 'ferdig' ? '' : fristTekst(o.frist)
                return (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', marginBottom: 8, background: pf.bg, border: `1.5px solid ${pf.border}`, borderRadius: 10, opacity: o.status === 'ferdig' ? 0.6 : 1 }}>
                    <input type="checkbox" checked={o.status === 'ferdig'} onChange={() => toggleOppgave(o)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: o.status === 'ferdig' ? '#888' : '#1a1a2e', textDecoration: o.status === 'ferdig' ? 'line-through' : 'none' }}>{o.tittel}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                        {o.ansvar && <div style={{ fontSize: 12, color: '#888' }}>👤 {o.ansvar}</div>}
                        {ft && <div style={{ fontSize: 12, fontWeight: 500, color: pf.color }}>{ft}</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: pf.color, whiteSpace: 'nowrap' }}>{o.status === 'ferdig' ? '🟢 Ferdig' : prioritetLabel(ep)}</div>
                    <button onClick={() => slettOppgave(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#ccc', flexShrink: 0 }}>🗑️</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {aktivSeksjon === 'analyse' && (
          <div>
            <button onClick={() => { setAktivSeksjon(null); nullstill() }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 36 }}>🔍</div>
              <div><h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Boliganalyse</h2><p style={{ color: '#666', margin: 0, fontSize: 14 }}>Analyser en ny eiendom og vurder potensial</p></div>
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 1 – Analyser boligen</div>
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Lim inn Finn.no-lenke eller beskriv eiendommen&#10;&#10;Eks: Villa 4 soverom, 180m², privat pool, 500m fra strand, €650 000, Marbella Golden Mile"
                style={{ width: '100%', height: 120, padding: 12, fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', resize: 'vertical', fontFamily: 'sans-serif' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={analyser} disabled={loading || !input} style={{ flex: 1, background: loading ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? '⏳ Analyserer...' : '🔍 Analyser eiendom'}
                </button>
                {(input || result) && <button onClick={nullstill} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: '14px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🗑️ Nullstill</button>}
              </div>
            </div>
            {result && (
              <div>
                <div style={{ background: '#1a1a2e', color: 'white', borderRadius: 12, padding: 24, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{result.type} · {result.beliggenhet}</div>
                  <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>{result.tittel}</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                    {[{ lbl: 'Pris', val: fmt(result.pris) }, { lbl: 'Egenkapital', val: fmt(result.ek_krav) }, { lbl: 'Mnd. betaling', val: fmt(result.mnd_betaling) }, { lbl: 'Yield', val: fmtPct(result.yield_estimat) }].map((item, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{item.lbl}</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 6 }}>🤖 AI-vurdering</div>
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', margin: 0 }}>{result.ai_vurdering}</p>
                </div>
                <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>🏛️ VFT-turistlisens</div>
                    <div style={{ background: result.vft_score >= 60 ? '#e8f5ed' : result.vft_score >= 35 ? '#fff8e1' : '#fde8ec', color: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#B05E0A' : '#C8102E', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{result.vft_score}/100</div>
                  </div>
                  <div style={{ background: '#f0f0f0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: result.vft_score + '%', height: 8, background: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#EF9F27' : '#C8102E', borderRadius: 6 }} />
                  </div>
                </div>
                {visSkjema && (
                  <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 2 – Fyll inn og sjekk info</div>
                    <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Vi har fylt inn det vi fant. Sjekk og legg til det som mangler.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                      {[
                        { key: 'type', lbl: 'Type bolig', placeholder: 'Villa / Leilighet', type: 'text' },
                        { key: 'beliggenhet', lbl: 'By og område', placeholder: 'Marbella', type: 'text' },
                        { key: 'soverom', lbl: 'Soverom', placeholder: '4', type: 'number' },
                        { key: 'bad', lbl: 'Bad', placeholder: '3', type: 'number' },
                        { key: 'areal', lbl: 'Areal (m²)', placeholder: '180', type: 'number' },
                        { key: 'avstand_strand', lbl: 'Avstand strand (m)', placeholder: '300', type: 'number' },
                        { key: 'pris', lbl: 'Kjøpspris (€)', placeholder: '650000', type: 'number' },
                        { key: 'markedspris_bra_m2', lbl: 'Markedspris bra std (€/m²)', placeholder: '3000', type: 'number' },
                        { key: 'ekstra', lbl: 'Ekstra info', placeholder: 'Pool, terrasse, golf...', type: 'text' },
                      ].map((f, i) => (
                        <div key={i} style={fieldStyle}>
                          <label style={labelStyle}>{f.lbl}</label>
                          <input style={inputStyle} type={f.type} value={(bolig as any)[f.key]} onChange={e => setBolig(b => ({ ...b, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                        </div>
                      ))}
                      {[
                        { key: 'basseng', lbl: 'Basseng', opts: [['privat', 'Privat basseng'], ['felles', 'Felles basseng'], ['ingen', 'Ingen basseng']] },
                        { key: 'parkering', lbl: 'Parkering', opts: [['garasje', 'Garasje'], ['privat', 'Privat'], ['felles', 'Felles'], ['ingen', 'Ingen']] },
                        { key: 'havutsikt', lbl: 'Havutsikt', opts: [['ja', 'Full havutsikt'], ['delvis', 'Delvis'], ['nei', 'Nei']] },
                        { key: 'standard', lbl: 'Standard', opts: [['luksus', 'Luksus'], ['moderne', 'Moderne'], ['standard', 'Standard'], ['oppussing', 'Trenger oppussing']] },
                      ].map((f, i) => (
                        <div key={i} style={fieldStyle}>
                          <label style={labelStyle}>{f.lbl}</label>
                          <select style={selectStyle} value={(bolig as any)[f.key]} onChange={e => setBolig(b => ({ ...b, [f.key]: e.target.value }))}>
                            {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 3 – Oppussingsbudsjett (valgfritt)</div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="number" value={bolig.oppbudsjett} onChange={e => setBolig(b => ({ ...b, oppbudsjett: e.target.value }))} placeholder="F.eks. 100000" style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd' }} />
                        <span style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>euro</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 4 – Kjør full analyse</div>
                    <button onClick={kjørAirbnbAnalyse} disabled={airbnbLoading} style={{ width: '100%', background: airbnbLoading ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 16, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: airbnbLoading ? 'not-allowed' : 'pointer' }}>
                      {airbnbLoading ? '⏳ Analyserer – 20-30 sekunder...' : '🚀 Kjør full analyse og få score'}
                    </button>
                  </div>
                )}
                {airbnbScore && (<div><div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 5 – Score og trafikklys</div><ScoreKort s={airbnbScore} /></div>)}
                {airbnbAnalyse && (
                  <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12 }}>📊 Fullstendig analyse</div>
                    <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#222' }}>{airbnbAnalyse}</div>
                  </div>
                )}

                {/* NY SEKSJON: Lagre som prosjekt */}
                <div style={{ background: '#f0f7ff', border: '2px solid #185FA544', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#185FA5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hva vil du gjøre med denne boligen?</div>
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 14, marginTop: 4 }}>Lagre boligen som et prosjekt – den blir lagt til i riktig kategori og vises også i Regnskap.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <button onClick={() => lagreAnalyseSomProsjekt('flipp')} style={{ background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🔨 Lagre som flipp-prosjekt</button>
                    <button onClick={() => lagreAnalyseSomProsjekt('utleie')} style={{ background: '#2D7D46', color: 'white', border: 'none', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🏖️ Lagre som utleieprosjekt</button>
                  </div>
                  {lagreMelding && (
                    <div style={{ marginTop: 12, padding: 12, background: lagreMelding.startsWith('✅') ? '#e8f5ed' : '#fde8ec', border: `1.5px solid ${lagreMelding.startsWith('✅') ? '#2D7D46' : '#C8102E'}`, borderRadius: 8, fontSize: 13, color: lagreMelding.startsWith('✅') ? '#1a4d2b' : '#7a0c1e', fontWeight: 500 }}>
                      {lagreMelding}
                    </div>
                  )}
                </div>

                <button onClick={nullstill} style={{ width: '100%', background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, marginBottom: 32 }}>🗑️ Nullstill og analyser ny eiendom</button>
              </div>
            )}
          </div>
        )}

        {aktivSeksjon === 'flipp' && (
          <div>
            <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 36 }}>🔨</div>
              <div><h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Boligflipp</h2><p style={{ color: '#666', margin: 0, fontSize: 14 }}>{flippProsjekter.length} prosjekt{flippProsjekter.length !== 1 ? 'er' : ''}</p></div>
            </div>
            {dbLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div> : (
              <BoligListe liste={flippProsjekter} tomTekst="Ingen flipp-prosjekter ennå" farge="#185FA5" />
            )}
          </div>
        )}

        {aktivSeksjon === 'utleie' && (
          <div>
            <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 36 }}>🏖️</div>
              <div><h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Boligutleie</h2><p style={{ color: '#666', margin: 0, fontSize: 14 }}>{utleieProsjekter.length} utleiebolig{utleieProsjekter.length !== 1 ? 'er' : ''}</p></div>
            </div>
            {dbLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div> : (
              <BoligListe liste={utleieProsjekter} tomTekst="Ingen utleieboliger ennå" farge="#2D7D46" />
            )}
          </div>
        )}

        {aktivSeksjon === 'selge' && !selgBolig && (
          <div>
            <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 36 }}>💰</div>
              <div><h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Selge bolig</h2><p style={{ color: '#666', margin: 0, fontSize: 14 }}>Beregn salgspris, skatt og fortjeneste</p></div>
            </div>
            {dbLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div> : (
              eideBoliger.length === 0 ? (
                <div style={{ background: '#f8f8f8', border: '2px dashed #ddd', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Du har ingen boliger å selge ennå</div>
                  <div style={{ fontSize: 13 }}>Boliger med status "Kjøpt", "Under oppussing" eller "Utleie" vises her</div>
                </div>
              ) : (
                <div>
                  {eideBoliger.map(p => {
                    const sf = statusFarge(p.status)
                    return (
                      <div key={p.id} onClick={() => {
                        setSelgBolig(p.id)
                        setSalgInput({ salgspris: p.forventet_salgsverdi || 0, megler_pst: 5, advokat_pst: 1, plusvalia: 0, skatteresidens: 'eu', ventetid_ar: 0 })
                        setMarkedsprisData(null)
                      }} style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 12, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{p.navn}</div>
                            <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                            <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
                          </div>
                          <button style={{ background: '#B05E0A', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💰 Beregn salg →</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                          <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Total investert</div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(totalInvestering(p))}</div>
                          </div>
                          <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Forventet salgsverdi</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#B05E0A' }}>{fmt(p.forventet_salgsverdi)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        )}

        {aktivSeksjon === 'selge' && selgBolig && (() => {
          const p = prosjekter.find(pr => pr.id === selgBolig)
          if (!p) return null
          const s = beregnSalg(p, salgInput)
          const cf = månedligCashflow(p)
          const ventetidCashflow = cf * 12 * salgInput.ventetid_ar
          const sf = statusFarge(p.status)

          return (
            <div>
              <button onClick={() => setSelgBolig(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake til liste</button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>💰 Selge: {p.navn}</h2>
                  <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                </div>
              </div>

              {/* Steg 1: Salgspris */}
              <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#B05E0A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 1 – Sett salgspris</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Ønsket salgspris (€)</label>
                    <input style={inputStyle} type="number" value={salgInput.salgspris || ''} onChange={e => setSalgInput(s => ({ ...s, salgspris: Number(e.target.value) }))} placeholder={p.forventet_salgsverdi.toString()} />
                  </div>
                  <div style={{ ...fieldStyle, justifyContent: 'flex-end' }}>
                    <button onClick={() => hentMarkedspris(p)} disabled={markedsprisLoading} style={{ background: markedsprisLoading ? '#999' : '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, cursor: markedsprisLoading ? 'not-allowed' : 'pointer' }}>
                      {markedsprisLoading ? '⏳ Henter...' : '📊 Hent markedspris'}
                    </button>
                  </div>
                </div>
                {markedsprisData && !markedsprisData.error && (
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 12, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>📍 Markedsdata</div>
                    {markedsprisData.markedspris_bra_m2 && <div>Markedspris per m²: <strong>€{markedsprisData.markedspris_bra_m2.toLocaleString('nb-NO')}</strong></div>}
                    {markedsprisData.pris && <div>Estimert salgspris for tilsvarende: <strong>€{markedsprisData.pris.toLocaleString('nb-NO')}</strong></div>}
                    {markedsprisData.ai_vurdering && <div style={{ marginTop: 6, color: '#555', fontStyle: 'italic' }}>{markedsprisData.ai_vurdering}</div>}
                  </div>
                )}
                {markedsprisData?.error && <div style={{ color: '#C8102E', fontSize: 13 }}>{markedsprisData.error}</div>}
              </div>

              {/* Steg 2: Salgskostnader og skatt */}
              <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#B05E0A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 2 – Salgskostnader og skatt</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Megler %</label>
                    <input style={inputStyle} type="number" step="0.1" value={salgInput.megler_pst || ''} onChange={e => setSalgInput(s => ({ ...s, megler_pst: Number(e.target.value) }))} placeholder="5" />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Advokat %</label>
                    <input style={inputStyle} type="number" step="0.1" value={salgInput.advokat_pst || ''} onChange={e => setSalgInput(s => ({ ...s, advokat_pst: Number(e.target.value) }))} placeholder="1" />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Plusvalía Municipal (€)</label>
                    <input style={inputStyle} type="number" value={salgInput.plusvalia || ''} onChange={e => setSalgInput(s => ({ ...s, plusvalia: Number(e.target.value) }))} placeholder="0" />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Skatteresidens</label>
                    <select style={selectStyle} value={salgInput.skatteresidens} onChange={e => setSalgInput(s => ({ ...s, skatteresidens: e.target.value as 'eu' | 'ikke_eu' }))}>
                      <option value="eu">🇪🇺 EU/EØS (19%)</option>
                      <option value="ikke_eu">🌍 Ikke-EU (24%)</option>
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 10, fontStyle: 'italic' }}>
                  💡 Plusvalía varierer per kommune og avhenger av valor catastral + eiertid. Spør kommunen (ayuntamiento) eller advokaten din for eksakt beløp.
                </div>
              </div>

              {/* Steg 3: Resultat */}
              <div style={{ background: s.nettoFortjeneste >= 0 ? '#e8f5ed' : '#fde8ec', border: `2px solid ${s.nettoFortjeneste >= 0 ? '#2D7D46' : '#C8102E'}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: s.nettoFortjeneste >= 0 ? '#1a4d2b' : '#7a0c1e', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 3 – Resultat</div>

                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Netto fortjeneste etter alt</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: s.nettoFortjeneste >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(s.nettoFortjeneste)}</div>
                  <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>ROI: <strong style={{ color: s.roiPst >= 0 ? '#2D7D46' : '#C8102E' }}>{s.roiPst.toFixed(1)}%</strong></div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>💵 Inntekter fra salg</div>
                  {[
                    { lbl: 'Salgspris', val: fmt(s.salgspris) },
                    { lbl: `Megler (${salgInput.megler_pst}%)`, val: '- ' + fmt(s.meglerBelop), farge: '#C8102E' },
                    { lbl: `Advokat (${salgInput.advokat_pst}%)`, val: '- ' + fmt(s.advokatBelop), farge: '#C8102E' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none', fontSize: 13 }}>
                      <span>{r.lbl}</span><span style={{ fontWeight: 600, color: r.farge }}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid rgba(0,0,0,0.15)', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                    <span>Netto salgssum</span><span>{fmt(s.nettoSalgssum)}</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏛️ Spansk skatt</div>
                  {[
                    { lbl: 'Total kjøp + oppussing (fradrag)', val: fmt(s.totalKjop) },
                    { lbl: 'Kapitalgevinst (grunnlag)', val: fmt(s.kapitalgevinst), bold: true },
                    { lbl: `CGT ${(s.cgtSats * 100).toFixed(0)}% (IRNR, Modelo 210)`, val: '- ' + fmt(s.cgt), farge: '#C8102E' },
                    { lbl: 'Plusvalía Municipal', val: '- ' + fmt(salgInput.plusvalia), farge: '#C8102E' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none', fontSize: 13 }}>
                      <span style={{ fontWeight: (r as any).bold ? 700 : 400 }}>{r.lbl}</span><span style={{ fontWeight: 600, color: r.farge }}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid rgba(0,0,0,0.15)', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                    <span>Total skatt</span><span style={{ color: '#C8102E' }}>{fmt(s.totalSkatt)}</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>💳 3% tilbakeholdelse (kjøper holder tilbake)</div>
                  <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
                    Kjøper holder tilbake <strong>{fmt(s.retention3pst)}</strong> (3% av salgspris) som forskudd på CGT. Dette sendes til spanske skattemyndigheter via Modelo 211.
                    <br /><br />
                    {s.differanseRetention > 0 ? (
                      <span>⚠️ CGT er høyere enn 3% retention. Du må betale <strong style={{ color: '#C8102E' }}>{fmt(s.differanseRetention)}</strong> ekstra via Modelo 210 (innen 4 måneder).</span>
                    ) : s.differanseRetention < 0 ? (
                      <span>✅ CGT er lavere enn 3% retention. Du får tilbake <strong style={{ color: '#2D7D46' }}>{fmt(Math.abs(s.differanseRetention))}</strong> når du leverer Modelo 210.</span>
                    ) : (
                      <span>Retention dekker akkurat CGT.</span>
                    )}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 Oppsummering</div>
                  {[
                    { lbl: 'Salgspris', val: fmt(s.salgspris) },
                    { lbl: '- Salgskostnader', val: fmt(s.salgskostnader), farge: '#C8102E' },
                    { lbl: '- Total skatt', val: fmt(s.totalSkatt), farge: '#C8102E' },
                    { lbl: '- Total investert (kjøp + oppussing + møblering)', val: fmt(s.totalInvestert), farge: '#C8102E' },
                    { lbl: '= Netto fortjeneste', val: fmt(s.nettoFortjeneste), farge: s.nettoFortjeneste >= 0 ? '#2D7D46' : '#C8102E', bold: true },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none', fontSize: 13 }}>
                      <span style={{ fontWeight: (r as any).bold ? 700 : 400 }}>{r.lbl}</span>
                      <span style={{ fontWeight: 700, color: r.farge, fontSize: (r as any).bold ? 15 : 13 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Break-even */}
              <div style={{ background: '#fff8e1', border: '2px solid #EF9F27', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#B05E0A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Break-even</div>
                <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}>
                  Minste salgspris for å gå i null (dekke alle kostnader, ingen gevinst):
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#B05E0A', marginTop: 6 }}>{fmt(s.breakEvenUtenGevinst)}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Dette gir 0 CGT fordi det ikke er gevinst. Plusvalía og salgskostnader er tatt med.</div>
                </div>
              </div>

              {/* Tidsaspekt */}
              {p.status === 'Utleie' && (
                <div style={{ background: '#f0f7ff', border: '2px solid #185FA5', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#185FA5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⏰ Vente eller selge nå?</div>
                  <div style={{ fontSize: 14, color: '#444', marginBottom: 12 }}>
                    Din månedlige cashflow: <strong style={{ color: cf >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(cf)}</strong>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Hvor mange år vil du vente med å selge?</label>
                    <input style={inputStyle} type="number" value={salgInput.ventetid_ar || ''} onChange={e => setSalgInput(s => ({ ...s, ventetid_ar: Number(e.target.value) }))} placeholder="0" />
                  </div>
                  {salgInput.ventetid_ar > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 10, padding: 14, marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
                      <div>Cashflow i {salgInput.ventetid_ar} år: <strong style={{ color: ventetidCashflow >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(ventetidCashflow)}</strong></div>
                      <div>Total fortjeneste hvis du selger nå: <strong>{fmt(s.nettoFortjeneste)}</strong></div>
                      <div>Total fortjeneste hvis du venter {salgInput.ventetid_ar} år (samme salgspris): <strong>{fmt(s.nettoFortjeneste + ventetidCashflow)}</strong></div>
                      <div style={{ marginTop: 8, fontStyle: 'italic', color: '#666' }}>
                        💡 For at det skal lønne seg å vente, må salgsprisen om {salgInput.ventetid_ar} år være høyere enn {fmt(s.salgspris - ventetidCashflow)} (hvis cashflow er positiv) eller du må regne med prisøkning som overstiger tap.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Handlingsknapper */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <button onClick={() => markerSomSolgt(p, salgInput.salgspris)} disabled={!salgInput.salgspris} style={{ background: salgInput.salgspris ? '#2D7D46' : '#ccc', color: 'white', border: 'none', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: 600, cursor: salgInput.salgspris ? 'pointer' : 'not-allowed' }}>✅ Marker som solgt</button>
                <button onClick={() => oppdaterProsjekt({ ...p, forventet_salgsverdi: salgInput.salgspris })} disabled={!salgInput.salgspris} style={{ background: salgInput.salgspris ? '#185FA5' : '#ccc', color: 'white', border: 'none', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: 600, cursor: salgInput.salgspris ? 'pointer' : 'not-allowed' }}>💾 Lagre som forventet salgsverdi</button>
              </div>

              <div style={{ fontSize: 11, color: '#999', fontStyle: 'italic', marginBottom: 32, lineHeight: 1.6 }}>
                ⚠️ Dette er kun et estimat. Faktisk skatt kan variere basert på dokumenterte fradrag, avtaler mellom Norge og Spania (dobbelbeskatningsavtalen), og individuelle forhold. Konsulter alltid en spansk gestor/advokat før du signerer en salgsavtale.
              </div>
            </div>
          )
        })()}

        {aktivSeksjon === 'regnskap' && (
          <div>
            <button onClick={() => { setAktivSeksjon(null); setVisProsjekt(null); setVisNyttSkjema(false); setRedigerProsjekt(null) }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 36 }}>📊</div>
                <div><h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Regnskap</h2><p style={{ color: '#666', margin: 0, fontSize: 14 }}>Alle eiendomsprosjekter</p></div>
              </div>
              {!visProsjekt && <button onClick={() => setVisNyttSkjema(!visNyttSkjema)} style={{ background: '#7B2D8B', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Nytt prosjekt</button>}
            </div>

            {dbLoading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div>}

            {prosjekter.length > 0 && !visProsjekt && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
                {[
                  { lbl: '🏠 Prosjekter', val: prosjekter.length.toString() },
                  { lbl: '💰 Total investert', val: fmt(prosjekter.reduce((s, p) => s + totalInvestering(p), 0)) },
                  { lbl: '📈 Cashflow/mnd', val: fmt(prosjekter.reduce((s, p) => s + månedligCashflow(p), 0)) },
                  { lbl: '✅ Aktive utleier', val: prosjekter.filter(p => p.status === 'Utleie').length.toString() },
                ].map((item, i) => (
                  <div key={i} style={{ background: '#f9f0ff', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.lbl}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#7B2D8B' }}>{item.val}</div>
                  </div>
                ))}
              </div>
            )}

            {visNyttSkjema && !visProsjekt && (
              <div style={{ background: '#f9f0ff', border: '2px solid #7B2D8B22', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#7B2D8B' }}>Nytt prosjekt</h3>
                <ProsjektFelter data={nyttProsjekt} onChange={setNyttProsjekt} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={leggTilProsjekt} style={{ flex: 1, background: '#7B2D8B', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>✅ Lagre prosjekt</button>
                  <button onClick={() => setVisNyttSkjema(false)} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
                </div>
              </div>
            )}

            {!visProsjekt && prosjekter.map(p => {
              const sf = statusFarge(p.status)
              const cf = månedligCashflow(p)
              return (
                <div key={p.id} style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{p.navn}</div>
                      <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                      <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
                      {p.dato_kjopt && <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>Kjøpt: {p.dato_kjopt}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setVisProsjekt(p.id)} style={{ background: '#7B2D8B', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Åpne</button>
                      <button onClick={() => slettProsjekt(p.id)} style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Slett</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    {[
                      { lbl: 'Total investert', val: fmt(totalInvestering(p)) },
                      { lbl: 'Cashflow/mnd', val: fmt(cf), farge: cf >= 0 ? '#2D7D46' : '#C8102E' },
                      { lbl: 'Yield', val: yield_pst(p).toFixed(1) + '%' },
                      { lbl: 'ROI ved salg', val: roi(p).toFixed(1) + '%' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{item.lbl}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: (item as any).farge || '#1a1a2e' }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {!visProsjekt && prosjekter.length === 0 && !visNyttSkjema && !dbLoading && (
              <div style={{ background: '#f9f0ff', border: '2px dashed #d4b8f4', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ingen prosjekter ennå</div>
                <div style={{ fontSize: 14 }}>Trykk "Nytt prosjekt" for å komme i gang!</div>
              </div>
            )}

            {visProsjekt && (() => {
              const p = prosjekter.find(pr => pr.id === visProsjekt)
              if (!p) return null
              const sf = statusFarge(p.status)
              const cf = månedligCashflow(p)
              const totalMånedInntekt = p.måneder.reduce((s, m) => s + m.inntekt, 0)
              const totalMånedKostnad = p.måneder.reduce((s, m) => s + m.kostnad, 0)
              const redigerer = redigerProsjekt?.id === p.id

              const arsinntekt = p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).reduce((s, m) => s + m.inntekt, 0)
              const arskostnadLogg = p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).reduce((s, m) => s + m.kostnad, 0)
              const fastKostAr = månedligKostnad(p) * 12
              const totalKostAr = arskostnadLogg + fastKostAr
              const nettoresultat = arsinntekt - totalKostAr

              return (
                <div>
                  <button onClick={() => { setVisProsjekt(null); setRedigerProsjekt(null); setAktivTab('oversikt') }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{p.navn}</h2>
                      <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                      <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setRedigerProsjekt(redigerer ? null : { ...p })} style={{ background: redigerer ? '#f0f0f0' : '#1a1a2e', color: redigerer ? '#444' : 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {redigerer ? 'Avbryt' : '✏️ Rediger'}
                      </button>
                      {redigerer && <button onClick={lagreRedigering} style={{ background: '#2D7D46', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💾 Lagre</button>}
                    </div>
                  </div>

                  {redigerer && redigerProsjekt && (
                    <div style={{ background: '#f9f0ff', border: '2px solid #7B2D8B22', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#7B2D8B' }}>✏️ Rediger prosjekt</h3>
                      <ProsjektFelter data={redigerProsjekt} onChange={setRedigerProsjekt} />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={lagreRedigering} style={{ flex: 1, background: '#2D7D46', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>💾 Lagre endringer</button>
                        <button onClick={() => setRedigerProsjekt(null)} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
                    {[
                      { lbl: '💰 Total investert', val: fmt(totalInvestering(p)), farge: '#7B2D8B' },
                      { lbl: '📈 Cashflow/mnd', val: fmt(cf), farge: cf >= 0 ? '#2D7D46' : '#C8102E' },
                      { lbl: '📊 Yield', val: yield_pst(p).toFixed(1) + '%', farge: '#185FA5' },
                      { lbl: '🏷️ ROI ved salg', val: roi(p).toFixed(1) + '%', farge: '#B05E0A' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: '#f9f0ff', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.lbl}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: item.farge }}>{item.val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {[{ id: 'oversikt', lbl: '📊 Oversikt' }, { id: 'arsrapport', lbl: '📋 Årsrapport' }].map(t => (
                      <button key={t.id} onClick={() => setAktivTab(t.id as any)}
                        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: aktivTab === t.id ? '#1a1a2e' : '#f0f0f0', color: aktivTab === t.id ? 'white' : '#444' }}>
                        {t.lbl}
                      </button>
                    ))}
                  </div>

                  {aktivTab === 'oversikt' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>💸 Investeringer</div>
                        {[
                          { lbl: 'Kjøpesum', val: fmt(p.kjøpesum) },
                          { lbl: 'Kjøpskostnader', val: fmt(p.kjøpskostnader) },
                          { lbl: 'Oppussing budsjett', val: fmt(p.oppussingsbudsjett) },
                          { lbl: 'Oppussing faktisk', val: fmt(p.oppussing_faktisk) },
                          { lbl: 'Møblering', val: fmt(p.møblering) },
                          { lbl: 'Forventet salgsverdi', val: fmt(p.forventet_salgsverdi) },
                        ].map((r, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
                            <span style={{ color: '#666' }}>{r.lbl}</span><span style={{ fontWeight: 600 }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📅 Månedlig</div>
                        {[
                          { lbl: 'Leieinntekt', val: fmt(p.leieinntekt_mnd), farge: '#2D7D46' },
                          { lbl: 'Lånebetaling', val: fmt(p.lån_mnd), farge: '#C8102E' },
                          { lbl: 'Fellesutgifter', val: fmt(p.fellesutgifter_mnd), farge: '#C8102E' },
                          { lbl: 'Strøm', val: fmt(p.strøm_mnd), farge: '#C8102E' },
                          { lbl: 'Forsikring', val: fmt(p.forsikring_mnd), farge: '#C8102E' },
                          { lbl: 'Forvaltning', val: fmt(p.forvaltning_mnd), farge: '#C8102E' },
                        ].map((r, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
                            <span style={{ color: '#666' }}>{r.lbl}</span><span style={{ fontWeight: 600, color: r.farge }}>{r.val}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #eee', fontSize: 14, marginTop: 4 }}>
                          <span style={{ fontWeight: 700 }}>Cashflow</span>
                          <span style={{ fontWeight: 700, color: cf >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(cf)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {aktivTab === 'arsrapport' && (
                    <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📋 Årsrapport</h3>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <select value={valgtAr} onChange={e => setValgtAr(Number(e.target.value))}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 }}>
                            {[2024, 2025, 2026, 2027].map(ar => <option key={ar} value={ar}>{ar}</option>)}
                          </select>
                          <button onClick={() => lastNedPDF(p, valgtAr)}
                            style={{ background: '#C8102E', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            📥 Last ned PDF
                          </button>
                        </div>
                      </div>

                      <div style={{ background: '#f0faf4', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a4d2b' }}>💰 Inntekter {valgtAr}</div>
                        {p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).length === 0 && (
                          <div style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>Ingen inntekter registrert for {valgtAr} – legg til i månedlig logg under</div>
                        )}
                        {p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).map((m, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #d0ead8' : 'none', fontSize: 13 }}>
                            <span style={{ color: '#444' }}>{m.måned}{m.notat ? ' – ' + m.notat : ''}</span>
                            <span style={{ fontWeight: 600, color: '#2D7D46' }}>{fmt(m.inntekt)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #2D7D46', fontSize: 14, marginTop: 4 }}>
                          <span style={{ fontWeight: 700 }}>Sum inntekter</span>
                          <span style={{ fontWeight: 700, color: '#2D7D46' }}>{fmt(arsinntekt)}</span>
                        </div>
                      </div>

                      <div style={{ background: '#fde8ec', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#7a0c1e' }}>📉 Kostnader {valgtAr}</div>
                        {[
                          { lbl: 'Lånebetaling (12 mnd)', val: p.lån_mnd * 12 },
                          { lbl: 'Fellesutgifter (12 mnd)', val: p.fellesutgifter_mnd * 12 },
                          { lbl: 'Strøm (12 mnd)', val: p.strøm_mnd * 12 },
                          { lbl: 'Forsikring (12 mnd)', val: p.forsikring_mnd * 12 },
                          { lbl: 'Forvaltning (12 mnd)', val: p.forvaltning_mnd * 12 },
                          { lbl: 'Variable kostnader (logg)', val: arskostnadLogg },
                        ].filter(r => r.val > 0).map((r, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #f5a3b0' : 'none', fontSize: 13 }}>
                            <span style={{ color: '#444' }}>{r.lbl}</span>
                            <span style={{ fontWeight: 600, color: '#C8102E' }}>{fmt(r.val)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #C8102E', fontSize: 14, marginTop: 4 }}>
                          <span style={{ fontWeight: 700 }}>Sum kostnader</span>
                          <span style={{ fontWeight: 700, color: '#C8102E' }}>{fmt(totalKostAr)}</span>
                        </div>
                      </div>

                      <div style={{ background: nettoresultat >= 0 ? '#e8f5ed' : '#fde8ec', border: `2px solid ${nettoresultat >= 0 ? '#2D7D46' : '#C8102E'}`, borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 Resultat {valgtAr}</div>
                        {[
                          { lbl: 'Sum inntekter', val: fmt(arsinntekt), farge: '#2D7D46' },
                          { lbl: 'Sum kostnader', val: fmt(totalKostAr), farge: '#C8102E' },
                          { lbl: 'Netto resultat', val: fmt(nettoresultat), farge: nettoresultat >= 0 ? '#2D7D46' : '#C8102E', bold: true },
                          { lbl: 'Yield (faktisk)', val: totalInvestering(p) > 0 ? ((arsinntekt / totalInvestering(p)) * 100).toFixed(1) + '%' : '–', farge: '#185FA5' },
                          { lbl: 'Total investering', val: fmt(totalInvestering(p)), farge: '#7B2D8B' },
                        ].map((r, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none', fontSize: 13 }}>
                            <span style={{ color: '#444', fontWeight: (r as any).bold ? 700 : 400 }}>{r.lbl}</span>
                            <span style={{ fontWeight: 700, color: r.farge, fontSize: (r as any).bold ? 15 : 13 }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {p.notater && (
                    <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: 14, marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📝 Notater</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.notater}</div>
                    </div>
                  )}

                  <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>📆 Månedlig logg</div>
                    {p.måneder.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 8, marginBottom: 6, fontSize: 11, color: '#888', fontWeight: 600 }}>
                          <div>MÅNED</div><div>INNTEKT</div><div>KOSTNAD</div><div>NOTAT</div>
                        </div>
                        {p.måneder.map((m, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 8, padding: '6px 0', borderTop: '1px solid #f0f0f0', fontSize: 13 }}>
                            <div style={{ fontWeight: 500 }}>{m.måned}</div>
                            <div style={{ color: '#2D7D46', fontWeight: 600 }}>{fmt(m.inntekt)}</div>
                            <div style={{ color: '#C8102E', fontWeight: 600 }}>{fmt(m.kostnad)}</div>
                            <div style={{ color: '#666' }}>{m.notat}</div>
                          </div>
                        ))}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 8, padding: '8px 0', borderTop: '2px solid #eee', fontSize: 13, fontWeight: 700 }}>
                          <div>Totalt</div>
                          <div style={{ color: '#2D7D46' }}>{fmt(totalMånedInntekt)}</div>
                          <div style={{ color: '#C8102E' }}>{fmt(totalMånedKostnad)}</div>
                          <div style={{ color: totalMånedInntekt - totalMånedKostnad >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(totalMånedInntekt - totalMånedKostnad)}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div style={fieldStyle}><label style={labelStyle}>Måned</label><input style={inputStyle} type="month" value={nyMåned.måned} onChange={e => setNyMåned(m => ({ ...m, måned: e.target.value }))} /></div>
                      <div style={fieldStyle}><label style={labelStyle}>Inntekt (€)</label><input style={inputStyle} type="number" value={nyMåned.inntekt || ''} onChange={e => setNyMåned(m => ({ ...m, inntekt: Number(e.target.value) }))} placeholder="3000" /></div>
                      <div style={fieldStyle}><label style={labelStyle}>Kostnad (€)</label><input style={inputStyle} type="number" value={nyMåned.kostnad || ''} onChange={e => setNyMåned(m => ({ ...m, kostnad: Number(e.target.value) }))} placeholder="2500" /></div>
                      <div style={fieldStyle}><label style={labelStyle}>Notat</label><input style={inputStyle} type="text" value={nyMåned.notat} onChange={e => setNyMåned(m => ({ ...m, notat: e.target.value }))} placeholder="F.eks. August utleie" /></div>
                    </div>
                    <button onClick={() => leggTilMåned(p.id)} style={{ background: '#7B2D8B', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Legg til måned</button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

      </main>

      {loggetInn && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
          {agentApen && (
            <div style={{ position: 'absolute', bottom: 72, right: 0, width: 360, background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#1a1a2e', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>🤖 Eiendomsassistent</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Spør meg om spansk eiendom</div>
                </div>
                <button onClick={() => setMeldinger([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>Tøm</button>
              </div>
              <div style={{ height: 340, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {meldinger.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 40 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏡</div>
                    Hei! Spør meg om VFT-lisens, Airbnb, skatt, finansiering eller eiendomsmarkedet i Spania!
                  </div>
                )}
                {meldinger.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: m.role === 'user' ? '#C8102E' : '#f0f0f0', color: m.role === 'user' ? 'white' : '#222', borderBottomRightRadius: m.role === 'user' ? 4 : 12, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12, whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {agentLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: '#f0f0f0', borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 13, color: '#666' }}>⏳ Tenker...</div>
                  </div>
                )}
                <div ref={chatBunnRef} />
              </div>
              <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
                <input value={agentInput} onChange={e => setAgentInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAgentMelding()} placeholder="Still et spørsmål..."
                  style={{ flex: 1, padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'sans-serif' }} />
                <button onClick={sendAgentMelding} disabled={agentLoading || !agentInput.trim()} style={{ background: agentLoading ? '#ccc' : '#C8102E', color: 'white', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 16, cursor: agentLoading ? 'not-allowed' : 'pointer' }}>→</button>
              </div>
            </div>
          )}
          <button onClick={() => setAgentApen(!agentApen)} style={{ width: 56, height: 56, borderRadius: '50%', background: '#1a1a2e', border: 'none', cursor: 'pointer', fontSize: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {agentApen ? '✕' : '🤖'}
          </button>
        </div>
      )}
    </div>
  )
}