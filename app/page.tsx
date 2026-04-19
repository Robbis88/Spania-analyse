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
  kjøpesum: number; kjøpskostnader: number; oppussingsbudsjett: number; oppussing_faktisk: number
  møblering: number; forventet_salgsverdi: number; leieinntekt_mnd: number; lån_mnd: number
  fellesutgifter_mnd: number; strøm_mnd: number; forsikring_mnd: number; forvaltning_mnd: number
  notater: string; måneder: { måned: string; inntekt: number; kostnad: number; notat: string }[]
}

const tomtProsjekt = (): Prosjekt => ({
  id: Date.now().toString(), bruker: 'leganger', navn: '', status: 'Under vurdering',
  dato_kjopt: '', kjøpesum: 0, kjøpskostnader: 0, oppussingsbudsjett: 0, oppussing_faktisk: 0,
  møblering: 0, forventet_salgsverdi: 0, leieinntekt_mnd: 0, lån_mnd: 0, fellesutgifter_mnd: 0,
  strøm_mnd: 0, forsikring_mnd: 0, forvaltning_mnd: 0, notater: '', måneder: []
})

function beregnEffektivPrioritet(o: Oppgave): 'hast' | 'normal' | 'lav' {
  if (o.status === 'ferdig') return o.prioritet
  if (!o.frist) return o.prioritet
  const idag = new Date()
  idag.setHours(0, 0, 0, 0)
  const frist = new Date(o.frist)
  frist.setHours(0, 0, 0, 0)
  const dagerIgjen = Math.ceil((frist.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))
  if (o.prioritet === 'hast') return 'hast'
  if (o.prioritet === 'normal') {
    if (dagerIgjen <= 1) return 'hast'
    return 'normal'
  }
  if (o.prioritet === 'lav') {
    if (dagerIgjen <= 1) return 'hast'
    if (dagerIgjen <= 2) return 'normal'
    return 'lav'
  }
  return o.prioritet
}

function fristTekst(frist: string): string {
  if (!frist) return ''
  const idag = new Date()
  idag.setHours(0, 0, 0, 0)
  const fristDato = new Date(frist)
  fristDato.setHours(0, 0, 0, 0)
  const dager = Math.ceil((fristDato.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))
  if (dager < 0) return `⚠️ ${Math.abs(dager)} dag${Math.abs(dager) !== 1 ? 'er' : ''} over frist`
  if (dager === 0) return '🔴 Frist i dag!'
  if (dager === 1) return '🔴 Frist i morgen'
  if (dager === 2) return '🟡 Frist om 2 dager'
  return `📅 Frist om ${dager} dager`
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
  const [oppgaver, setOppgaver] = useState<Oppgave[]>([])
  const [nyOppgave, setNyOppgave] = useState({ tittel: '', ansvar: '', prioritet: 'normal' as 'hast' | 'normal' | 'lav', frist: '' })
  const [visNyOppgave, setVisNyOppgave] = useState(false)
  const [agentApen, setAgentApen] = useState(false)
  const [meldinger, setMeldinger] = useState<Melding[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const chatBunnRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (loggetInn) hentOppgaver() }, [loggetInn])
  useEffect(() => { if (loggetInn && aktivSeksjon === 'regnskap') hentProsjekter() }, [loggetInn, aktivSeksjon])
  useEffect(() => { chatBunnRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger])

  async function sendAgentMelding() {
    if (!agentInput.trim() || agentLoading) return
    const nyeMeldinger: Melding[] = [...meldinger, { role: 'user', content: agentInput }]
    setMeldinger(nyeMeldinger)
    setAgentInput('')
    setAgentLoading(true)
    try {
      const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meldinger: nyeMeldinger }) })
      const data = await res.json()
      setMeldinger([...nyeMeldinger, { role: 'assistant', content: data.svar }])
    } catch {
      setMeldinger([...nyeMeldinger, { role: 'assistant', content: 'Beklager, noe gikk galt. Prøv igjen.' }])
    }
    setAgentLoading(false)
  }

  async function hentOppgaver() {
    const { data } = await supabase.from('oppgaver').select('*').order('opprettet', { ascending: false })
    if (data) {
      const sortert = [...data].sort((a, b) => {
        if (a.status === 'ferdig' && b.status !== 'ferdig') return 1
        if (a.status !== 'ferdig' && b.status === 'ferdig') return -1
        const epA = beregnEffektivPrioritet(a as Oppgave)
        const epB = beregnEffektivPrioritet(b as Oppgave)
        const pr = { hast: 0, normal: 1, lav: 2 }
        return pr[epA] - pr[epB]
      })
      setOppgaver(sortert as Oppgave[])
    }
  }

  async function leggTilOppgave() {
    if (!nyOppgave.tittel) return
    await supabase.from('oppgaver').insert([{ id: Date.now().toString(), ...nyOppgave, status: 'aktiv' }])
    setNyOppgave({ tittel: '', ansvar: '', prioritet: 'normal', frist: '' })
    setVisNyOppgave(false)
    await hentOppgaver()
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

  function loggInn() {
    if (passordInput === PASSORD) { setLoggetInn(true); setPassordFeil(false) }
    else setPassordFeil(true)
  }

  async function analyser() {
    setLoading(true); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setVisSkjema(false)
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

  function nullstill() { setInput(''); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setVisSkjema(false) }

  const fmt = (n: number) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'
  const fmtPct = (n: number) => n ? n.toFixed(1) + '%' : '–'
  const totalInvestering = (p: Prosjekt) => p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering
  const månedligKostnad = (p: Prosjekt) => p.lån_mnd + p.fellesutgifter_mnd + p.strøm_mnd + p.forsikring_mnd + p.forvaltning_mnd
  const månedligCashflow = (p: Prosjekt) => p.leieinntekt_mnd - månedligKostnad(p)
  const yield_pst = (p: Prosjekt) => totalInvestering(p) > 0 ? ((p.leieinntekt_mnd * 12) / totalInvestering(p) * 100) : 0
  const roi = (p: Prosjekt) => totalInvestering(p) > 0 ? ((p.forventet_salgsverdi - totalInvestering(p)) / totalInvestering(p) * 100) : 0

  const statusFarge = (s: string) => {
    if (s === 'Utleie') return { bg: '#e8f5ed', color: '#2D7D46' }
    if (s === 'Kjøpt') return { bg: '#f0f7ff', color: '#185FA5' }
    if (s === 'Under oppussing') return { bg: '#fff8e1', color: '#B05E0A' }
    if (s === 'Solgt') return { bg: '#f0f0f0', color: '#666' }
    return { bg: '#fde8ec', color: '#C8102E' }
  }

  const prioritetFarge = (ep: string, status: string) => {
    if (status === 'ferdig') return { bg: '#e8f5ed', border: '#2D7D46', color: '#2D7D46' }
    if (ep === 'hast') return { bg: '#fde8ec', border: '#C8102E', color: '#C8102E' }
    if (ep === 'normal') return { bg: '#fff8e1', border: '#B05E0A', color: '#B05E0A' }
    return { bg: '#f8f8f8', border: '#ddd', color: '#666' }
  }

  const prioritetLabel = (ep: string) => ep === 'hast' ? '🔴 Hast' : ep === 'normal' ? '🟡 Normal' : '⚪ Lav'

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'sans-serif' }
  const selectStyle = { width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd' }
  const labelStyle = { fontSize: 12, color: '#666', marginBottom: 5, display: 'block' as const }
  const fieldStyle = { display: 'flex', flexDirection: 'column' as const }

  const ProsjektFelter = ({ data, onChange }: { data: Prosjekt, onChange: (p: Prosjekt) => void }) => (
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

  const ScoreKort = ({ s }: { s: any }) => (
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

  const GjøremålListe = () => (
    <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📋 Gjøremål</h2>
        <button onClick={() => setVisNyOppgave(!visNyOppgave)} style={{ background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Ny oppgave</button>
      </div>

      {visNyOppgave && (
        <div style={{ background: '#f8f8f8', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Oppgave</label>
              <input style={inputStyle} value={nyOppgave.tittel} onChange={e => setNyOppgave(o => ({ ...o, tittel: e.target.value }))} placeholder="Hva skal gjøres?" onKeyDown={e => e.key === 'Enter' && leggTilOppgave()} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Ansvar</label>
              <input style={inputStyle} value={nyOppgave.ansvar} onChange={e => setNyOppgave(o => ({ ...o, ansvar: e.target.value }))} placeholder="Hvem?" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Frist</label>
              <input style={inputStyle} type="date" value={nyOppgave.frist} onChange={e => setNyOppgave(o => ({ ...o, frist: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Prioritet</label>
              <select style={selectStyle} value={nyOppgave.prioritet} onChange={e => setNyOppgave(o => ({ ...o, prioritet: e.target.value as any }))}>
                <option value="hast">🔴 Hast</option>
                <option value="normal">🟡 Normal</option>
                <option value="lav">⚪ Lav</option>
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
            <div style={{ fontSize: 12, fontWeight: 600, color: pf.color, whiteSpace: 'nowrap' }}>
              {o.status === 'ferdig' ? '🟢 Ferdig' : prioritetLabel(ep)}
            </div>
            <button onClick={() => slettOppgave(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#ccc', flexShrink: 0 }}>🗑️</button>
          </div>
        )
      })}
    </div>
  )

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
            {/* FIRE BOKSER */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { id: 'flipp', emoji: '🔨', tittel: 'Boligflipp', beskrivelse: 'Analyser kjøp, oppussing og videresalg', farge: '#185FA5', bg: '#f0f7ff' },
                { id: 'utleie', emoji: '🏖️', tittel: 'Boligutleie', beskrivelse: 'Analyser Airbnb-potensial og investorscore', farge: '#C8102E', bg: '#fff5f5' },
                { id: 'selge', emoji: '💰', tittel: 'Selge bolig', beskrivelse: 'Analyser markedsverdi og salgsstrategi', farge: '#2D7D46', bg: '#f0faf4' },
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

            {/* GJØREMÅL UNDER BOKSENE */}
            <GjøremålListe />
          </div>
        )}

        {/* BOLIGUTLEIE */}
        {aktivSeksjon === 'utleie' && (
          <div>
            <button onClick={() => { setAktivSeksjon(null); nullstill() }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 36 }}>🏖️</div>
              <div><h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Boligutleie – Spania</h2><p style={{ color: '#666', margin: 0, fontSize: 14 }}>Analyser Airbnb-potensial og investorscore</p></div>
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
                      {airbnbLoading ? '⏳ Analyserer – 20-30 sekunder...' : '🚀 Kjør Airbnb-analyse og få score'}
                    </button>
                  </div>
                )}
                {airbnbScore && (<div><div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 5 – Score og trafikklys</div><ScoreKort s={airbnbScore} /></div>)}
                {airbnbAnalyse && (
                  <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12 }}>📊 Fullstendig Airbnb-analyse</div>
                    <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#222' }}>{airbnbAnalyse}</div>
                  </div>
                )}
                <button onClick={nullstill} style={{ width: '100%', background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, marginBottom: 32 }}>🗑️ Nullstill og analyser ny eiendom</button>
              </div>
            )}
          </div>
        )}

        {aktivSeksjon === 'flipp' && (
          <div>
            <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ background: '#f0f7ff', border: '2px dashed #b8d4f4', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}><div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div><div style={{ fontSize: 16, fontWeight: 600 }}>Under utvikling</div></div>
          </div>
        )}

        {aktivSeksjon === 'selge' && (
          <div>
            <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
            <div style={{ background: '#f0faf4', border: '2px dashed #b8dfc7', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}><div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div><div style={{ fontSize: 16, fontWeight: 600 }}>Under utvikling</div></div>
          </div>
        )}

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
              return (
                <div>
                  <button onClick={() => { setVisProsjekt(null); setRedigerProsjekt(null) }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{p.navn}</h2>
                      <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
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

      {/* AI AGENT */}
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