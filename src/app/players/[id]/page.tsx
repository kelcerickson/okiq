// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, POSITION_LABELS, STAT_DEFS } from '@/lib/supabase'

export default function PlayerDetail() {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [matchHistory, setMatchHistory] = useState([])
  const [aggregated, setAggregated] = useState({})
  const [positionsPlayed, setPositionsPlayed] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [strengths, setStrengths] = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoaded, setAiLoaded] = useState(false)

  useEffect(() => { loadPlayer() }, [id])

  async function loadPlayer() {
    const { data: p } = await supabase.from('players').select('id,name,jersey_number').eq('id', id).single()
    if (!p) { setLoading(false); return }
    setPlayer(p)

    const { data: mp } = await supabase
      .from('match_players')
      .select(`
        position_entries(id, position, stats(stat_key, value)),
        match:matches(id, opponent, match_date, finished)
      `)
      .eq('player_id', id)

    const finishedMatches = (mp || []).filter(x => x.match?.finished)
    setMatchHistory(finishedMatches)

    // Aggregate all stats by position
    const byPos = {}
    for (const m of finishedMatches) {
      for (const pe of m.position_entries || []) {
        if (!byPos[pe.position]) byPos[pe.position] = {}
        for (const s of pe.stats || []) {
          byPos[pe.position][s.stat_key] = (byPos[pe.position][s.stat_key] || 0) + s.value
        }
      }
    }
    setAggregated(byPos)
    setPositionsPlayed(Object.keys(byPos))
    setLoading(false)
  }

  async function loadAI() {
    if (aiLoaded || !matchHistory.length) return
    setAiLoading(true)

    const ctx = matchHistory.map(m => {
      const stats = {}
      for (const pe of m.position_entries || []) {
        const defs = STAT_DEFS[pe.position] || []
        for (const s of defs) {
          if (s.type === 'rate') {
            const h = pe.stats?.find(x => x.stat_key === s.key + '_hit')?.value || 0
            const ms = pe.stats?.find(x => x.stat_key === s.key + '_miss')?.value || 0
            const t = h + ms
            if (t > 0) stats[s.label] = parseFloat(((h / t) * 100).toFixed(1)) + '%'
          } else {
            const v = pe.stats?.find(x => x.stat_key === s.key)?.value || 0
            if (v > 0) stats[s.label] = v
          }
        }
      }
      return { match: `vs ${m.match.opponent} (${m.match.match_date})`, stats }
    })

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: player.name, matchHistory: ctx })
      })
      const data = await res.json()
      setStrengths(data.strengths || [])
      setOpportunities(data.improvements || [])
      setAiSummary(data.summary || '')
      setAiLoaded(true)
    } catch (e) {}
    setAiLoading(false)
  }

  const getStatDisplay = (pos, key, type) => {
    const stats = aggregated[pos] || {}
    if (type === 'rate') {
      const h = stats[key + '_hit'] || 0
      const ms = stats[key + '_miss'] || 0
      const t = h + ms
      return t > 0 ? ((h / t) * 100).toFixed(1) + '%' : '—'
    }
    return stats[key] || 0
  }

  if (loading) return <div className="shell"><div className="body"><div className="nodata">Loading...</div></div></div>
  if (!player) return <div className="shell"><div className="body"><div className="nodata">Player not found.</div></div></div>

  return (
    <div className="shell">
      <header className="hdr">
        <Link href="/players" className="btn btn-ghost btn-sm">← Players</Link>
      </header>
      <div className="body">

        {/* Player header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(170,255,0,0.12)', border: '2px solid rgba(170,255,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 500, color: '#AAFF00', flexShrink: 0 }}>
            {player.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>
              {player.name}
              {player.jersey_number && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>#{player.jersey_number}</span>}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {matchHistory.length} match{matchHistory.length !== 1 ? 'es' : ''} · {positionsPlayed.map(p => POSITION_LABELS[p]).join(', ')}
            </div>
          </div>
        </div>

        {matchHistory.length === 0 && (
          <div className="nodata">No finished matches yet for this player.</div>
        )}

        {/* AI Strengths & Opportunities */}
        {matchHistory.length > 0 && (
          <div style={{ background: 'rgba(170,255,0,0.06)', border: '1px solid rgba(170,255,0,0.25)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#AAFF00' }} />
                <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: '#AAFF00' }}>AI Coach</span>
              </div>
              {!aiLoaded && !aiLoading && (
                <button onClick={loadAI} className="btn btn-sm btn-oneon">Analyze player</button>
              )}
            </div>

            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                <div className="ai-spinner" />
                Analyzing {player.name.split(' ')[0]}'s performance...
              </div>
            )}

            {aiLoaded && (
              <>
                {aiSummary && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.6 }}>{aiSummary}</p>
                )}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#AAFF00', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                    Top strengths
                  </div>
                  {strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(170,255,0,0.15)', border: '1px solid rgba(170,255,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#AAFF00', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <span style={{ fontSize: 13, color: '#fff', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#FF8C42', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                    Top opportunities
                  </div>
                  {opportunities.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,140,66,0.15)', border: '1px solid rgba(255,140,66,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#FF8C42', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <span style={{ fontSize: 13, color: '#fff', lineHeight: 1.5 }}>{o}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!aiLoaded && !aiLoading && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Tap "Analyze player" to get AI-powered insights based on match data.</p>
            )}
          </div>
        )}

        {/* Stats by position */}
        {positionsPlayed.map(pos => {
          const defs = STAT_DEFS[pos] || []
          return (
            <div key={pos} style={{ background: '#161616', border: '1px solid rgba(170,255,0,0.15)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className={`pp pp-${pos}`} style={{ fontSize: 12, padding: '4px 10px' }}>{POSITION_LABELS[pos]}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {defs.map(s => (
                  <div key={s.key} style={{ background: '#1C1C1C', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: '#AAFF00' }}>{getStatDisplay(pos, s.key, s.type)}</div>
                    {s.type === 'rate' && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {(aggregated[pos]?.[s.key + '_hit'] || 0)}/{((aggregated[pos]?.[s.key + '_hit'] || 0) + (aggregated[pos]?.[s.key + '_miss'] || 0))} attempts
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
