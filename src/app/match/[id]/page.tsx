// @ts-nocheck
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, POSITION_LABELS, STAT_DEFS } from '@/lib/supabase'

export default function LiveMatch() {
  const { id } = useParams()
  const router = useRouter()
  const [match, setMatch] = useState(null)
  const [matchPlayers, setMatchPlayers] = useState([])
  const [posEntries, setPosEntries] = useState([])
  const [stats, setStats] = useState([])
  const [activePlayerId, setActivePlayerId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: m }, { data: mp }] = await Promise.all([
      supabase.from('matches').select('opponent,match_date,location,join_code').eq('id', id).single(),
      supabase.from('match_players').select('id,player_id,current_pos,player:players(id,name,jersey_number)').eq('match_id', id),
    ])
    if (m) setMatch(m)
    if (mp) {
      setMatchPlayers(mp)
      if (mp.length && !activePlayerId) setActivePlayerId(mp[0].player_id)
      const mpIds = mp.map(p => p.id)
      if (mpIds.length) {
        const { data: pe } = await supabase.from('position_entries').select('*').in('match_player_id', mpIds)
        if (pe) {
          setPosEntries(pe)
          const peIds = pe.map(e => e.id)
          if (peIds.length) {
            const { data: st } = await supabase.from('stats').select('*').in('position_entry_id', peIds)
            if (st) setStats(st)
          }
        }
      }
    }
  }, [id, activePlayerId])

  useEffect(() => { load() }, [id])

  const activeMp = matchPlayers.find(mp => mp.player_id === activePlayerId)

  async function setPosition(pos) {
    if (!activeMp) return
    const myEntries = posEntries.filter(e => e.match_player_id === activeMp.id)
    for (const e of myEntries.filter(e => e.active)) {
      await supabase.from('position_entries').update({ active: false }).eq('id', e.id)
    }
    let existing = myEntries.find(e => e.position === pos)
    if (!existing) {
      const { data } = await supabase.from('position_entries').insert({
        match_player_id: activeMp.id, position: pos, active: true
      }).select().single()
      existing = data
      if (existing) {
        const defs = STAT_DEFS[pos] || []
        const statsToInsert = defs.flatMap(s => s.type === 'rate'
          ? [
              { position_entry_id: existing.id, stat_key: s.key + '_hit', value: 0 },
              { position_entry_id: existing.id, stat_key: s.key + '_miss', value: 0 }
            ]
          : [{ position_entry_id: existing.id, stat_key: s.key, value: 0 }]
        )
        await supabase.from('stats').insert(statsToInsert)
      }
    } else {
      await supabase.from('position_entries').update({ active: true }).eq('id', existing.id)
    }
    await supabase.from('match_players').update({ current_pos: pos }).eq('id', activeMp.id)
    await load()
  }

  async function adjustStat(entryId, statKey, delta) {
    const current = stats.find(s => s.position_entry_id === entryId && s.stat_key === statKey)
    const newVal = Math.max(0, (current?.value || 0) + delta)
    const { error } = await supabase.from('stats')
      .update({ value: newVal })
      .eq('position_entry_id', entryId)
      .eq('stat_key', statKey)
    if (!error) {
      setStats(prev => {
        const idx = prev.findIndex(s => s.position_entry_id === entryId && s.stat_key === statKey)
        if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], value: newVal }; return next }
        return [...prev, { id: '', position_entry_id: entryId, stat_key: statKey, value: newVal }]
      })
    }
  }

  async function finishMatch() {
    setSaving(true)
    const { error } = await supabase.from('matches').update({ finished: true }).eq('id', id)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    router.push(`/match/${id}`)
  }

  const activeEntry = posEntries.find(e => e.match_player_id === activeMp?.id && e.active)
  const activeDefs = activeEntry ? (STAT_DEFS[activeEntry.position] || []) : []
  const prevEntries = posEntries.filter(e => e.match_player_id === activeMp?.id && !e.active)

  const getVal = (entryId, key) => stats.find(s => s.position_entry_id === entryId && s.stat_key === key)?.value || 0

  if (!match) return <div className="shell"><div className="body"><div className="nodata">Loading...</div></div></div>

  return (
    <div className="shell">
      <header className="hdr">
        <Link href="/" className="btn btn-ghost btn-sm">← Home</Link>
        <button className="btn btn-oneon btn-sm" onClick={finishMatch} disabled={saving}>
          {saving ? 'Saving...' : 'Finish match'}
        </button>
      </header>
      <div className="body">

        {/* Match banner */}
        <div className="mbanner">
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>vs {match.opponent}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {match.match_date}{match.location ? ` · ${match.location}` : ''}
          </div>
          <div style={{ fontSize: 12, color: '#AAFF00', marginTop: 5 }}>
            Join code: <strong>{match.join_code}</strong>
          </div>
          <div className="lbadge" style={{ marginTop: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#000' }} />
            Live
          </div>
        </div>

        {/* Player chips */}
        <div className="slbl">Players</div>
        <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {matchPlayers.map(mp => (
            <div key={mp.player_id}
              className={`pchip ${mp.player_id === activePlayerId ? 'active' : ''}`}
              onClick={() => setActivePlayerId(mp.player_id)}>
              {mp.player.name.split(' ')[0]}
              {mp.player.jersey_number && <span style={{ fontSize: 10, opacity: .6 }}> #{mp.player.jersey_number}</span>}
              {mp.current_pos && <span className={`pp pp-${mp.current_pos}`} style={{ fontSize: 10, padding: '1px 5px', marginLeft: 2 }}>{mp.current_pos}</span>}
            </div>
          ))}
        </div>

        {/* Active player card */}
        {activeMp && (
          <div className="card">
            {/* Player info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="av" style={{ width: 40, height: 40, fontSize: 14 }}>
                {activeMp.player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#1A1A1A' }}>
                  {activeMp.player.name}
                  {activeMp.player.jersey_number && <span style={{ fontSize: 13, color: '#888', marginLeft: 6 }}>#{activeMp.player.jersey_number}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {activeMp.current_pos
                    ? <span className={`pp pp-${activeMp.current_pos}`}>{POSITION_LABELS[activeMp.current_pos]}</span>
                    : 'No position set'}
                </div>
              </div>
            </div>

            {/* Position buttons */}
            <div className="slbl">Position</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {(['F','M','D','G']).map(pos => (
                <button key={pos}
                  className={`pbtn ${activeMp.current_pos === pos ? 'a' + pos : ''}`}
                  onClick={() => setPosition(pos)}>
                  {POSITION_LABELS[pos]}
                </button>
              ))}
            </div>

            {/* Stat blocks */}
            {activeEntry ? (
              <>
                <div className="slbl">Stats — {POSITION_LABELS[activeEntry.position]}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {activeDefs.map(s => {
                    if (s.type === 'rate') {
                      const hit = getVal(activeEntry.id, s.key + '_hit')
                      const miss = getVal(activeEntry.id, s.key + '_miss')
                      const tot = hit + miss
                      const rate = tot > 0 ? ((hit / tot) * 100).toFixed(1) + '%' : '—'
                      return (
                        <div key={s.key} style={{
                          background: '#1E1E1E', borderRadius: 12, padding: '14px 16px',
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                          {/* Label + rate */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</span>
                            <span style={{ fontSize: 26, fontWeight: 700, color: '#AAFF00' }}>{rate}</span>
                          </div>
                          {tot > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>{hit}/{tot} attempts</div>}
                          {/* Hit row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{s.hitL}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <button style={btnStyle} onClick={() => adjustStat(activeEntry.id, s.key + '_hit', -1)}>−</button>
                              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', minWidth: 28, textAlign: 'center' }}>{hit}</span>
                              <button style={plusStyle} onClick={() => adjustStat(activeEntry.id, s.key + '_hit', 1)}>+</button>
                            </div>
                          </div>
                          {/* Miss row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{s.missL}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <button style={btnStyle} onClick={() => adjustStat(activeEntry.id, s.key + '_miss', -1)}>−</button>
                              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', minWidth: 28, textAlign: 'center' }}>{miss}</span>
                              <button style={plusStyle} onClick={() => adjustStat(activeEntry.id, s.key + '_miss', 1)}>+</button>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    // Count stat
                    const val = getVal(activeEntry.id, s.key)
                    return (
                      <div key={s.key} style={{
                        background: '#1E1E1E', borderRadius: 12, padding: '14px 16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 32, fontWeight: 700, color: '#AAFF00', lineHeight: 1 }}>{val}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <button style={btnLgStyle} onClick={() => adjustStat(activeEntry.id, s.key, -1)}>−</button>
                          <button style={plusLgStyle} onClick={() => adjustStat(activeEntry.id, s.key, 1)}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="nodata" style={{ padding: '1rem 0', color: '#888' }}>Set a position to log stats</div>
            )}

            {/* Previous positions */}
            {prevEntries.length > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '16px 0' }} />
                <div className="slbl">Previous positions this match</div>
                {prevEntries.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13, color: '#666' }}>
                    <span className={`pp pp-${e.position}`}>{POSITION_LABELS[e.position]}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Button styles defined once — easy to tweak
const btnStyle = {
  width: 40, height: 40, borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.15)',
  background: '#2E2E2E', color: '#fff',
  fontSize: 22, fontWeight: 500, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent', flexShrink: 0,
}
const plusStyle = {
  ...btnStyle,
  background: '#AAFF00', border: '1px solid #88CC00', color: '#1A1A1A', fontWeight: 700,
}
const btnLgStyle = {
  width: 52, height: 52, borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.15)',
  background: '#2E2E2E', color: '#fff',
  fontSize: 26, fontWeight: 500, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent', flexShrink: 0,
}
const plusLgStyle = {
  ...btnLgStyle,
  background: '#AAFF00', border: '1px solid #88CC00', color: '#1A1A1A', fontWeight: 700,
}
