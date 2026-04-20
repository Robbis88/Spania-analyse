'use client'
import type { Prosjekt } from '../types'
import { inputStyle, selectStyle, labelStyle, fieldStyle } from '../lib/styles'

export function ProsjektFelter({ data, onChange }: { data: Prosjekt; onChange: (p: Prosjekt) => void }) {
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
          <input
            style={inputStyle}
            type={f.type}
            value={(data as unknown as Record<string, string | number>)[f.key] || ''}
            onChange={e => onChange({ ...data, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
            placeholder={f.placeholder}
          />
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
        <textarea
          value={data.notater}
          onChange={e => onChange({ ...data, notater: e.target.value })}
          placeholder="F.eks. Kontakt: Maria Lopez, advokat..."
          style={{ width: '100%', height: 80, padding: 12, fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', resize: 'vertical', fontFamily: 'sans-serif' }}
        />
      </div>
    </div>
  )
}
