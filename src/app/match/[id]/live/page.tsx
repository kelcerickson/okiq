'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, POSITION_LABELS, STAT_DEFS, type Position } from '@/lib/supabase'

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>()
  const [match, setMatch] = useState<any>(null)
  const [tab, setTab] = useState<'match' | 'team' | 'player'>('match')
  const [players, setPlayers] = useState<any[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const load = useCallback(async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', id).single()
    setMatch(m)
    const { data: mp } = await supabase.from('match_players').select(`
      id, player_id, current_pos,
      player:players(id,name,jersey_number),
      position_entries(id,position,active,stats(stat_key,value))
    `).eq('match_id', id)
    setPlayers(mp || [])
  }, [id])

  useEffect(() => { load() }, [id])

  function getStatVal(mp: any, key: string) {
    let hitT = 0, missT = 0, countT = 0, isRate = false, has = false
    for (const pe of mp.position_entries || []) {
      const defs = STAT_DEFS[pe.position as Position] || []
      const def = defs.find((s: any) => s.key === key)
      if (!def) continue
      if (def.type === 'rate') {
        isRate = true
        hitT += pe.stats?.find((s: any) => s.stat_key === key + '_hit')?.value || 0
        missT += pe.stats?.find((s: any) => s.stat_key === key + '_miss')?.value || 0
        has = true
      } else {
        countT += pe.stats?.find((s: any) => s.stat_key === key)?.value || 0
        has = true
      }
    }
    if (!has) return null
    if (isRate) { const t = hitT + missT; return t > 0 ? hitT / t * 100 : null }
    return countT
  }

  function teamTotal(key: string) {
    return players.reduce((a, p) => a + (getStatVal(p, key) || 0), 0)
  }

  async function openPlayer(mp: any) {
    setSelectedPlayer(mp)
    setAiResult(null)
    setAiLoading(true)
    // Build context from all finished matches
    const { data: allMp } = await supabase.from('match_players').select(`
      position_entries(id,position,stats(stat_key,value)),
      match:matches(opponent,match_date,finished)
    `).eq('player_id', mp.player_id)
    const finished = (allMp || []).filter((x: any) => x.match?.finished)
    const ctx = finished.map((x: any) => {
      const stats: any = {}
      for (const pe of x.position_entries || []) {
        const defs = STAT_DEFS[pe.position as Position] || []
        defs.forEach((s: any) => {
          if (s.type === 'rate') {
            const h = pe.stats?.find((st: any) => st.stat_key === s.key + '_hit')?.value || 0
            const ms = pe.stats?.find((st: any) => st.stat_key === s.key + '_miss')?.value || 0
            const t = h + ms
            if (t > 0) stats[s.key] = parseFloat(((h / t) * 100).toFixed(1))
          } else {
            const v = pe.stats?.find((st: any) => st.stat_key === s.key)?.value || 0
            if (v > 0) stats[s.key] = v
          }
        })
      }
      return { match: `vs ${x.match.opponent} (${x.match.match_date})`, stats }
    })
    try {
      const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerName: mp.player.name, matchHistory: ctx }) })
      const data = await res.json()
      setAiResult(data)
    } catch { setAiResult(null) }
    setAiLoading(false)
  }

  if (!match) return <div className="shell"><div className="body"><div className="nodata">Loading...</div></div></div>

  const maxGoals = Math.max(...players.map(p => getStatVal(p, 'goals') || 0), 1)
  const pcrPlayers = players.map(p => ({ p, v: getStatVal(p, 'pcr') })).filter(x => x.v !== null).sort((a: any, b: any) => b.v - a.v)

  return (
    <div className="shell">
      <header className="hdr">
        <Link href="/" className="btn btn-ghost btn-sm">← Home</Link>
        {!match.finished && <Link href={`/match/${id}/live`} className="btn btn-oneon btn-sm">Resume live</Link>}
      </header>
      <div className="body">
        <div className="mbanner" style={{ borderColor: 'rgba(170,255,0,0.3)' }}>
          <div style={{ fontSize: 19, fontWeight: 500 }}>vs {match.opponent}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {match.match_date}{match.location ? ` · ${match.location}` : ''}
          </div>
          <span style={{ display: 'inline-block', fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(170,255,0,0.1)', color: '#AAFF00', border: '1px solid rgba(170,255,0,0.3)', fontWeight: 500, marginTop: 6 }}>
            {match.finished ? 'Final' : 'In progress'}
          </span>
        </div>

        <div className="atabs">
          {(['match', 'team', 'player'] as const).map(t => (
            <button key={t} className={`atab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setSelectedPlayer(null) }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'match' && (
          <>
            <div className="slbl">Match summary</div>
            <div className="mg" style={{ marginBottom: 14 }}>
              {['goals','assists','sot','tackles','interceptions'].map(k => (
                <div key={k} className="mc">
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--neon)' }}>{teamTotal(k)}</div>
                </div>
              ))}
            </div>
            <div className="slbl">Goals</div>
            <div style={{ marginBottom: 12 }}>
              {[...players].sort((a, b) => (getStatVal(b, 'goals') || 0) - (getStatVal(a, 'goals') || 0)).map(p => {
                const v = getStatVal(p, 'goals') || 0
                return <div key={p.player_id} className="br">
                  <span className="bn">{p.player.name.split(' ')[0]}{p.player.jersey_number ? ' #' + p.player.jersey_number : ''}</span>
                  <div className="bt"><div className="bf" style={{ width: `${(v / maxGoals * 100).toFixed(1)}%` }} /></div>
                  <span className="bv">{v}</span>
                </div>
              })}
            </div>
            <div className="slbl">Pass completion</div>
            <div>
              {pcrPlayers.map(({ p, v }: any) => (
                <div key={p.player_id} className="br">
                  <span className="bn">{p.player.name.split(' ')[0]}{p.player.jersey_number ? ' #' + p.player.jersey_number : ''}</span>
                  <div className="bt"><div className="bf" style={{ width: `${(v as number).toFixed(1)}%` }} /></div>
                  <span className="bv">{(v as number).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'team' && (
          <>
            <div className="slbl">Team totals</div>
            <div className="mg" style={{ marginBottom: 14 }}>
              {['goals','assists','sot','tackles','interceptions'].map(k => (
                <div key={k} className="mc">
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--neon)' }}>{teamTotal(k)}</div>
                </div>
              ))}
            </div>
            {['goals','tackles','interceptions'].map(k => {
              const mx = Math.max(...players.map(p => getStatVal(p, k) || 0), 1)
              return (
                <div key={k}>
                  <div className="slbl">{k} by player</div>
                  <div style={{ marginBottom: 12 }}>
                    {[...players].sort((a, b) => (getStatVal(b, k) || 0) - (getStatVal(a, k) || 0)).map(p => {
                      const v = getStatVal(p, k) || 0
                      return <div key={p.player_id} className="br">
                        <span className="bn">{p.player.name.split(' ')[0]}</span>
                        <div className="bt"><div className="bf" style={{ width: `${(v / mx * 100).toFixed(1)}%` }} /></div>
                        <span className="bv">{v}</span>
                      </div>
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'player' && !selectedPlayer && (
          <>
            <div className="slbl">Select a player</div>
            {players.map(p => {
              const g = getStatVal(p, 'goals') || 0
              const a = getStatVal(p, 'assists') || 0
              const pcr = getStatVal(p, 'pcr')
              const positions = [...new Set((p.position_entries || []).map((e: any) => e.position))]
              return (
                <div key={p.player_id} className="sr" onClick={() => openPlayer(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="av" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {p.player.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.player.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 4 }}>
                        {positions.map((pos: any) => <span key={pos} className={`pp pp-${pos}`}>{pos}</span>)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {[['Goals', g], ['Assists', a], ['Pass %', pcr !== null ? (pcr as number).toFixed(0) + '%' : '—']].map(([lbl, val]) => (
                      <div key={lbl as string} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--neon)' }}>{val as string}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{lbl as string}</div>
                      </div>
                    ))}
                    <span style={{ color: 'var(--dim)', fontSize: 16 }}>›</span>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'player' && selectedPlayer && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => setSelectedPlayer(null)}>← Players</button>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{selectedPlayer.player.name}</div>
            {(selectedPlayer.position_entries || []).map((pe: any) => {
              const defs = STAT_DEFS[pe.position as Position] || []
              return (
                <div key={pe.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span className={`pp pp-${pe.position}`} style={{ fontSize: 12, padding: '4px 10px' }}>{POSITION_LABELS[pe.position as Position]}</span>
                  </div>
                  <div className="mg">
                    {defs.map((s: any) => {
                      if (s.type === 'rate') {
                        const h = pe.stats?.find((st: any) => st.stat_key === s.key + '_hit')?.value || 0
                        const ms = pe.stats?.find((st: any) => st.stat_key === s.key + '_miss')?.value || 0
                        const t = h + ms
                        return <div key={s.key} className="mc">
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
                          <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--neon)' }}>{t > 0 ? ((h / t) * 100).toFixed(1) + '%' : '—'}</div>
                          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>{t > 0 ? `${h}/${t}` : 'no data'}</div>
                        </div>
                      }
                      const v = pe.stats?.find((st: any) => st.stat_key === s.key)?.value || 0
                      return <div key={s.key} className="mc">
                        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--neon)' }}>{v}</div>
                      </div>
                    })}
                  </div>
                </div>
              )
            })}
            <div className="ai-box">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--neon)', marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon)' }} />AI Coach
              </div>
              {aiLoading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}><div className="ai-spinner" />Analyzing {selectedPlayer.player.name.split(' ')[0]}'s stats...</div>}
              {aiResult && !aiLoading && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10 }}>{aiResult.summary}</div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--neon)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>Strengths</div>
                    {aiResult.strengths?.map((s: string) => <span key={s} className="strength-chip">{s}</span>)}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--neon)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>Areas to improve</div>
                    {aiResult.improvements?.map((s: string) => <span key={s} className="improve-chip">{s}</span>)}
                  </div>
                  <div style={{ background: 'var(--black6)', borderRadius: 8, padding: 10, border: '1px solid var(--b3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--neon)', textTransform: 'uppercase', marginBottom: 4 }}>Coach's tip</div>
                    <div style={{ fontSize: 13 }}>{aiResult.tip}</div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
