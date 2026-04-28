'use client'
import Image from 'next/image'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'

const MØRK = '#1a2a3e'
const CREAM = '#f8f5ee'
const CREAM_LYS = '#faf7f0'
const GULL = '#c9a876'

type BoligDetalj = {
  id: string
  navn: string
  pris_natt: number | null
  pris_uke: number | null
  min_netter: number | null
  maks_gjester: number | null
  beskrivelse: string | null
  kort_beskrivelse: string | null
  fasiliteter: string[]
  bolig_data: {
    type?: string
    beliggenhet?: string
    soverom?: string | number
    bad?: string | number
    areal?: string | number
    avstand_strand?: string | number
    basseng?: string
    parkering?: string
    havutsikt?: string
  }
  bilder: { id: string; url: string | null }[]
}

const fmtEur = (n: number | null) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : null

export default function BoligDetaljSide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [bolig, setBolig] = useState<BoligDetalj | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [aktivBilde, setAktivBilde] = useState(0)

  useEffect(() => {
    let avbrutt = false
    fetch(`/api/utleie-portal/${id}`)
      .then(r => r.json())
      .then((data: { bolig?: BoligDetalj; feil?: string }) => {
        if (avbrutt) return
        if (data.feil) setFeil(data.feil)
        else if (data.bolig) setBolig(data.bolig)
        setLaster(false)
      })
      .catch(e => {
        if (avbrutt) return
        setFeil(e instanceof Error ? e.message : 'Ukjent feil')
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [id])

  return (
    <div style={{ fontFamily: 'sans-serif', background: CREAM, minHeight: '100vh' }}>
      <Header />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>
        <Link href="/" style={{ fontSize: 13, color: '#666', textDecoration: 'none', marginBottom: 20, display: 'inline-block' }}>← Tilbake til boliger</Link>

        {laster && <div style={{ textAlign: 'center', color: '#888', padding: 80 }}>⏳ Henter bolig...</div>}
        {feil && <div style={{ background: '#fde8ec', border: '1.5px solid #C8102E', borderRadius: 10, padding: 20, color: '#7a0c1e', marginTop: 20 }}>{feil}</div>}

        {bolig && (
          <>
            <BildeGalleri bilder={bolig.bilder} aktiv={aktivBilde} onVelg={setAktivBilde} />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32, marginTop: 36 }}>
              <div>
                <div style={{ fontSize: 12, color: GULL, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>{bolig.bolig_data.beliggenhet || 'SPANIA'}</div>
                <h1 style={{ fontSize: 32, fontWeight: 700, color: MØRK, margin: '0 0 14px', lineHeight: 1.2 }}>{bolig.navn}</h1>
                {bolig.kort_beskrivelse && <p style={{ fontSize: 16, color: '#555', lineHeight: 1.6, margin: '0 0 24px' }}>{bolig.kort_beskrivelse}</p>}

                <FaktaBånd bolig={bolig} />

                {bolig.beskrivelse && (
                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: MØRK, margin: '0 0 12px' }}>Om boligen</h2>
                    <p style={{ fontSize: 14, color: '#444', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{bolig.beskrivelse}</p>
                  </div>
                )}

                {bolig.fasiliteter.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: MØRK, margin: '0 0 12px' }}>Fasiliteter</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                      {bolig.fasiliteter.map((f, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#444', padding: '6px 0' }}>✓ {f}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <KontaktSkjema prosjektId={bolig.id} prosjektNavn={bolig.navn} prisNatt={bolig.pris_natt} prisUke={bolig.pris_uke} minNetter={bolig.min_netter} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Header() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: CREAM_LYS,
      borderBottom: `1px solid ${GULL}44`,
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <Image src="/logo.png" alt="Leganger & Osvaag Eiendom" width={44} height={44} style={{ objectFit: 'contain' }} priority />
        <span style={{ fontSize: 14, fontWeight: 700, color: MØRK, letterSpacing: '0.08em' }}>LEGANGER &amp; OSVAAG</span>
      </Link>
      <Link href="/admin" style={{ fontSize: 12, color: '#777', textDecoration: 'none', border: `1px solid ${GULL}66`, padding: '6px 12px', borderRadius: 6 }}>Logg inn</Link>
    </nav>
  )
}

function BildeGalleri({ bilder, aktiv, onVelg }: { bilder: { id: string; url: string | null }[]; aktiv: number; onVelg: (i: number) => void }) {
  if (bilder.length === 0) {
    return (
      <div style={{ width: '100%', height: 400, background: '#f0ede5', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: '#ccc' }}>
        🏖️
      </div>
    )
  }
  const aktivBilde = bilder[aktiv] || bilder[0]
  return (
    <div>
      <div style={{ width: '100%', aspectRatio: '16 / 10', background: '#f0ede5', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
        {aktivBilde.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={aktivBilde.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      {bilder.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(bilder.length, 6)}, 1fr)`, gap: 8 }}>
          {bilder.slice(0, 6).map((b, i) => (
            <button key={b.id} onClick={() => onVelg(i)} style={{
              border: i === aktiv ? `2px solid ${GULL}` : `2px solid transparent`,
              borderRadius: 8, padding: 0, cursor: 'pointer', overflow: 'hidden',
              aspectRatio: '4 / 3', background: '#f0ede5',
            }}>
              {b.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FaktaBånd({ bolig }: { bolig: BoligDetalj }) {
  const fakta: Array<[string, string]> = []
  if (bolig.maks_gjester) fakta.push(['Gjester', `Inntil ${bolig.maks_gjester}`])
  if (bolig.bolig_data.soverom) fakta.push(['Soverom', String(bolig.bolig_data.soverom)])
  if (bolig.bolig_data.bad) fakta.push(['Bad', String(bolig.bolig_data.bad)])
  if (bolig.bolig_data.areal) fakta.push(['Areal', `${bolig.bolig_data.areal} m²`])
  if (bolig.bolig_data.avstand_strand) fakta.push(['Til strand', `${bolig.bolig_data.avstand_strand} m`])
  if (bolig.bolig_data.basseng && bolig.bolig_data.basseng !== 'ingen') fakta.push(['Basseng', bolig.bolig_data.basseng])
  if (bolig.bolig_data.havutsikt && bolig.bolig_data.havutsikt !== 'nei') fakta.push(['Havutsikt', bolig.bolig_data.havutsikt])
  if (bolig.min_netter) fakta.push(['Min. opphold', `${bolig.min_netter} netter`])

  if (fakta.length === 0) return null

  return (
    <div style={{ background: 'white', border: `1px solid ${GULL}33`, borderRadius: 12, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
      {fakta.map(([lbl, val], i) => (
        <div key={i}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: MØRK, marginTop: 2 }}>{val}</div>
        </div>
      ))}
    </div>
  )
}

function KontaktSkjema({ prosjektId, prosjektNavn, prisNatt, prisUke, minNetter }: { prosjektId: string; prosjektNavn: string; prisNatt: number | null; prisUke: number | null; minNetter: number | null }) {
  const [navn, setNavn] = useState('')
  const [epost, setEpost] = useState('')
  const [telefon, setTelefon] = useState('')
  const [fra, setFra] = useState('')
  const [til, setTil] = useState('')
  const [gjester, setGjester] = useState('')
  const [melding, setMelding] = useState('')
  const [sender, setSender] = useState(false)
  const [resultat, setResultat] = useState<'ok' | 'feil' | null>(null)
  const [feilTekst, setFeilTekst] = useState('')

  async function send() {
    if (!navn || !epost) return
    setSender(true); setResultat(null); setFeilTekst('')
    try {
      const res = await fetch('/api/utleie-portal/foresporsel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prosjekt_id: prosjektId,
          navn, epost, telefon: telefon || null,
          fra_dato: fra || null, til_dato: til || null,
          antall_gjester: gjester ? Number(gjester) : null,
          melding: melding || null,
        }),
      })
      const data = await res.json()
      if (data.suksess) {
        setResultat('ok')
        setNavn(''); setEpost(''); setTelefon(''); setFra(''); setTil(''); setGjester(''); setMelding('')
      } else {
        setResultat('feil'); setFeilTekst(data.feil || 'Ukjent feil')
      }
    } catch (e) {
      setResultat('feil'); setFeilTekst(e instanceof Error ? e.message : 'Ukjent feil')
    }
    setSender(false)
  }

  const feltStil: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 6, border: '1.5px solid #ddd',
    fontFamily: 'sans-serif', boxSizing: 'border-box', background: 'white',
  }
  const lblStil: React.CSSProperties = { display: 'block', fontSize: 11, color: '#777', marginBottom: 4, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }

  return (
    <div style={{ background: 'white', borderRadius: 16, border: `1px solid ${GULL}44`, padding: 24, position: 'sticky', top: 84, alignSelf: 'start' }}>
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${GULL}33` }}>
        {prisNatt && <div><span style={{ fontSize: 22, fontWeight: 700, color: MØRK }}>{fmtEur(prisNatt)}</span><span style={{ fontSize: 13, color: '#777' }}> /natt</span></div>}
        {prisUke && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{fmtEur(prisUke)} /uke</div>}
        {minNetter && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Minimum {minNetter} netter</div>}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: MØRK, marginBottom: 14 }}>Send forespørsel</div>

      {resultat === 'ok' && (
        <div style={{ background: '#e8f5ed', border: '1.5px solid #2D7D46', borderRadius: 8, padding: 12, fontSize: 13, color: '#1a4d2b', marginBottom: 14 }}>
          ✅ Takk! Vi tar kontakt så snart vi kan.
        </div>
      )}
      {resultat === 'feil' && (
        <div style={{ background: '#fde8ec', border: '1.5px solid #C8102E', borderRadius: 8, padding: 12, fontSize: 13, color: '#7a0c1e', marginBottom: 14 }}>
          ❌ {feilTekst}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={lblStil}>Navn *</label><input style={feltStil} value={navn} onChange={e => setNavn(e.target.value)} /></div>
        <div><label style={lblStil}>E-post *</label><input style={feltStil} type="email" value={epost} onChange={e => setEpost(e.target.value)} /></div>
        <div><label style={lblStil}>Telefon</label><input style={feltStil} type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label style={lblStil}>Fra</label><input style={feltStil} type="date" value={fra} onChange={e => setFra(e.target.value)} /></div>
          <div><label style={lblStil}>Til</label><input style={feltStil} type="date" value={til} onChange={e => setTil(e.target.value)} /></div>
        </div>
        <div><label style={lblStil}>Antall gjester</label><input style={feltStil} type="number" min={1} value={gjester} onChange={e => setGjester(e.target.value)} /></div>
        <div><label style={lblStil}>Melding</label><textarea style={{ ...feltStil, minHeight: 80, resize: 'vertical' }} value={melding} onChange={e => setMelding(e.target.value)} placeholder={`Forespørsel om ${prosjektNavn}...`} /></div>
        <button onClick={send} disabled={sender || !navn || !epost}
          style={{ background: sender || !navn || !epost ? '#999' : MØRK, color: 'white', border: 'none', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: 700, cursor: sender || !navn || !epost ? 'not-allowed' : 'pointer', marginTop: 6 }}>
          {sender ? '⏳ Sender...' : '📧 Send forespørsel'}
        </button>
      </div>
    </div>
  )
}
