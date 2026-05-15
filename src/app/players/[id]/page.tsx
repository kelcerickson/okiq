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
  const [view, setView] = useState('stats') // 'stats' | 'coach' | 'drills'
  const [aiLoading, setAiLoading] = useState(false)
  const [aiData, setAiData] = useState(null)
  const [drillsData, setDrillsData] = useState(null)
  const [drillsLoading, setDrillsLoading] = useState(false)

  useEffect(() => { loadPlayer() }, [id])

  async function loadPlayer() {
    const { data: p } = await supabase.from('players').select('id,name,jersey_number').eq('id', id).single()
    if (!p) { setLoading(false); return }
    setPlayer(p)
    const { data: mp } = await supabase
      .from('match_players')
      .select('position_entries(id,position,stats(stat_key,value)),match:matches(id,opponent,match_date,finished)')
      .eq('player_id', id)
    const finished = (mp || []).filter(x => x.match?.finished)
    setMatchHistory(finished)
    const byPos = {}
    for (const m of finished) {
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

  function buildContext() {
    return matchHistory.map(m => {
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
      return { match: `vs ${m.match.opponent}`, stats }
    })
  }

  async function loadAI() {
    if (aiData || !matchHistory.length) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: player.name, matchHistory: buildContext(), mode: 'analyze' })
      })
      setAiData(await res.json())
    } catch (e) {}
    setAiLoading(false)
  }

  async function loadDrills() {
    if (drillsData) { setView('drills'); return }
    setView('drills')
    setDrillsLoading(true)
    // Pass the improvement areas to get targeted drills
    const ctx = aiData?.improvements || ['pass completion', 'dribbling']
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: player.name, matchHistory: ctx, mode: 'drills' })
      })
      setDrillsData(await res.json())
    } catch (e) {}
    setDrillsLoading(false)
  }

  async function switchToCoach() {
    setView('coach')
    if (!aiData) await loadAI()
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

  const firstName = player.name.split(' ')[0]

  return (
    <div className="shell">
      <header className="hdr">
        <Link href="/players" className="btn btn-ghost btn-sm">← Players</Link>
      </header>
      <div className="body">

        {/* Player header */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1E1E1E', border: '2px solid #AAFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#AAFF00', flexShrink: 0 }}>
            {player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>
              {player.name}
              {player.jersey_number && <span style={{ fontSize: 14, color: '#888', marginLeft: 8 }}>#{player.jersey_number}</span>}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {matchHistory.length} match{matchHistory.length !== 1 ? 'es' : ''}
              {positionsPlayed.length > 0 && ' · ' + positionsPlayed.map(p => POSITION_LABELS[p]).join(', ')}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[['stats', '📊 Stats'], ['coach', '🤖 AI Coach'], ['drills', '⚽ Drills']].map(([key, label]) => (
            <button key={key}
              onClick={() => key === 'coach' ? switchToCoach() : key === 'drills' ? loadDrills() : setView('stats')}
              style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: '2px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .1s',
                borderColor: view === key ? '#AAFF00' : 'rgba(0,0,0,0.1)',
                background: view === key ? '#1E1E1E' : '#fff',
                color: view === key ? '#AAFF00' : '#555',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* STATS VIEW */}
        {view === 'stats' && (
          <>
            {matchHistory.length === 0 && <div className="nodata">No finished matches yet.</div>}
            {positionsPlayed.map(pos => {
              const defs = STAT_DEFS[pos] || []
              return (
                <div key={pos} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <span className={`pp pp-${pos}`} style={{ fontSize: 13, padding: '5px 12px' }}>{POSITION_LABELS[pos]}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                    {defs.map(s => {
                      const display = getStatDisplay(pos, s.key, s.type)
                      const h = aggregated[pos]?.[s.key + '_hit'] || 0
                      const ms = aggregated[pos]?.[s.key + '_miss'] || 0
                      return (
                        <div key={s.key} style={{ background: '#1E1E1E', borderRadius: 10, padding: '12px 10px' }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#AAFF00' }}>{display}</div>
                          {s.type === 'rate' && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{h+ms > 0 ? `${h}/${h+ms}` : 'no data'}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {matchHistory.length > 0 && (
              <button onClick={loadDrills} className="btn btn-neon" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: 14, marginTop: 4 }}>
                ⚽ Get suggested drills for {firstName}
              </button>
            )}
          </>
        )}

        {/* AI COACH VIEW */}
        {view === 'coach' && (
          <div style={{ background: '#1E1E1E', border: '1px solid #AAFF00', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#AAFF00' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#AAFF00', textTransform: 'uppercase', letterSpacing: '.06em' }}>AI Coach</span>
            </div>

            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                <div className="ai-spinner" /> Analyzing {firstName}'s games...
              </div>
            )}

            {!aiData && !aiLoading && matchHistory.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Finish a match to unlock AI coaching.</p>
            )}

            {aiData && !aiLoading && (
              <>
                <p style={{ fontSize: 15, color: '#fff', fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>{aiData.summary}</p>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#AAFF00', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>What {firstName} is great at 🌟</div>
                  {aiData.strengths?.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(170,255,0,0.2)', border: '1px solid #AAFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#AAFF00', flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF8C42', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>What to work on 💪</div>
                  {aiData.improvements?.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,140,66,0.2)', border: '1px solid #FF8C42', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#FF8C42', flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{o}</span>
                    </div>
                  ))}
                </div>

                {aiData.tip && (
                  <div style={{ background: 'rgba(170,255,0,0.08)', border: '1px solid rgba(170,255,0,0.2)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#AAFF00', marginBottom: 6 }}>THIS WEEK'S TIP 🎯</div>
                    <div style={{ fontSize: 15, color: '#fff', lineHeight: 1.5 }}>{aiData.tip}</div>
                  </div>
                )}

                <button onClick={loadDrills} className="btn btn-neon" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: 12 }}>
                  ⚽ See suggested drills
                </button>
              </>
            )}
          </div>
        )}

        {/* DRILLS VIEW */}
        {view === 'drills' && (
          <>
            {drillsLoading && (
              <div style={{ background: '#1E1E1E', borderRadius: 14, padding: 24, display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                <div className="ai-spinner" /> Finding the best drills for {firstName}...
              </div>
            )}

            {drillsData && !drillsLoading && (
              <>
                {drillsData.intro && (
                  <div style={{ background: '#1E1E1E', border: '1px solid #AAFF00', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#AAFF00', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>⚽ Your personalized drills</div>
                    <p style={{ fontSize: 15, color: '#fff', fontWeight: 500, lineHeight: 1.5 }}>{drillsData.intro}</p>
                  </div>
                )}

                {drillsData.drills?.map((drill, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    {/* Drill header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⚽</div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>{drill.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{drill.time} · {drill.equipment}</div>
                      </div>
                    </div>

                    {/* Pro tip */}
                    {drill.pro && (
                      <div style={{ background: '#1E1E1E', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>🌟</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#AAFF00', marginBottom: 4 }}>{drill.pro} says:</div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, fontStyle: 'italic' }}>"{drill.proTip}"</div>
                        </div>
                      </div>
                    )}

                    {/* What to do */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>What to do</div>
                      <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>{drill.whatToDo}</div>
                    </div>

                    {/* Make it fun */}
                    {drill.makeItFun && (
                      <div style={{ background: 'rgba(170,255,0,0.08)', border: '1px solid rgba(170,255,0,0.25)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#2A6600', marginBottom: 4 }}>🎮 Make it fun!</div>
                        <div style={{ fontSize: 14, color: '#2A4400', lineHeight: 1.5 }}>{drill.makeItFun}</div>
                      </div>
                    )}
                  </div>
                ))}

                <button onClick={() => { setDrillsData(null); loadDrills() }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 14, marginTop: 4 }}>
                  🔄 Get new drills
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
