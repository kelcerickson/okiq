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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1E1E1E', border: '2px solid #AAFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: '#AAFF00', flexShrink: 0 }}>
            {player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A' }}>
              {player.name}
              {player.jersey_number && <span style={{ fontSize: 14, color: '#888', marginLeft: 8 }}>#{player.jersey_number}</span>}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 3 }}>
              {matchHistory.length} match{matchHistory.length !== 1 ? 'es' : ''}
              {positionsPlayed.length > 0 && ' · ' + positionsPlayed.map(p => POSITION_LABELS[p]).join(', ')}
            </div>
          </div>
        </div>

        {matchHistory.length === 0 && (
          <div className="nodata">No finished matches yet for this player.</div>
        )}

        {/* AI Coach box */}
        {matchHistory.length > 0 && (
          <div style={{ background: '#1E1E1E', border: '1px solid #AAFF00', borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#AAFF00' }} />
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#AAFF00' }}>AI Coach</span>
              </div>
              {!aiLoaded && !aiLoading && (
                <button onClick={loadAI} className="btn btn-neon btn-sm">Analyze player</button>
              )}
            </div>

            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                <div className="ai-spinner" />
                Analyzing {player.name.split(' ')[0]}'s performance...
              </div>
            )}

            {!aiLoaded && !aiLoading && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
                Tap "Analyze player" to get AI-powered insights based on match data.
              </p>
            )}

            {aiLoaded && (
              <>
                {aiSummary && (
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', marginBottom: 16, lineHeight: 1.6 }}>{aiSummary}</p>
                )}

                {/* Strengths */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#AAFF00', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                    Top strengths
                  </div>
                  {strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(170,255,0,0.2)', border: '1px solid #AAFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#AAFF00', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <span style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>

                {/* Opportunities */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#FF8C42', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                    Top opportunities
                  </div>
                  {opportunities.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,140,66,0.2)', border: '1px solid #FF8C42', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#FF8C42', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <span style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 1.5 }}>{o}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Stats by position */}
        {positionsPlayed.map(pos => {
          const defs = STAT_DEFS[pos] || []
          return (
            <div key={pos} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span className={`pp pp-${pos}`} style={{ fontSize: 13, padding: '5px 12px' }}>{POSITION_LABELS[pos]}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                {defs.map(s => {
                  const display = getStatDisplay(pos, s.key, s.type)
                  const hitVal = aggregated[pos]?.[s.key + '_hit'] || 0
                  const missVal = aggregated[pos]?.[s.key + '_miss'] || 0
                  const total = hitVal + missVal
                  return (
                    <div key={s.key} style={{ background: '#1E1E1E', borderRadius: 10, padding: '12px 10px' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: '#AAFF00' }}>{display}</div>
                      {s.type === 'rate' && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                          {total > 0 ? `${hitVal}/${total}` : 'no data'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
