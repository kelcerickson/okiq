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
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], value: newVal }
          return next
        }
        return [...prev, { id: '', position_entry_id: entryId, stat_key: statKey, value: newVal }]
      })
    }
  }

  async function finishMatch() {
    setSaving(true)
    const { error } = await supabase.from('matches').update({ finished: true }).eq('id', id)
    if (error) {
      alert('Error finishing match: ' + error.message)
      setSaving(false)
      return
    }
    router.push(`/match/${id}`)
  }

  const activeEntry = posEntries.find(e => e.match_player_id === activeMp?.id && e.active)
  const activeDefs = activeEntry ? (STAT_DEFS[activeEntry.position] || []) : []
  const prevEntries = posEntries.filter(e => e.match_player_id === activeMp?.id && !e.active)

  if (!match) return (
    <div className="shell">
      <div className="body"><div className="nodata">Loading...</div></div>
    </div>
  )

  return (
    <div className="shell">
      <header className="hdr">
        <Link href="/" className="btn btn-ghost btn-sm">← Home</Link>
        <button className="btn btn-oneon btn-sm" onClick={finishMatch} disabled={saving}>
          {saving ? 'Saving...' : 'Finish match'}
        </button>
      </header>
      <div className="body">
        <div className="mbanner">
          <div style={{ fontSize: 19, fontWeight: 500 }}>vs {match.opponent}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {match.match_date}{match.location ? ` · ${match.location}` : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--neon)', marginTop: 4 }}>
            Join code: <strong>{match.join_code}</strong> — share with parents to co-log
          </div>
          <div className="lbadge">
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#000' }} />
            Live
          </div>
        </div>

        <div className="slbl">Players</div>
        <div style={{ marginBottom: 13, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {matchPlayers.map(mp => (
            <div
              key={mp.player_id}
              className={`pchip ${mp.player_id === activePlayerId ? 'active' : ''}`}
              onClick={() => setActivePlayerId(mp.player_id)}
            >
              {mp.player.name.split(' ')[0]}
              {mp.player.jersey_number && (
                <span style={{ fontSize: 10, opacity: .6 }}> #{mp.player.jersey_number}</span>
              )}
              {mp.current_pos && (
                <span className={`pp pp-${mp.current_pos}`} style={{ fontSize: 10, padding: '1px 5px' }}>
                  {mp.current_pos}
                </span>
              )}
            </div>
          ))}
        </div>

        {activeMp && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
              <div className="av" style={{ width: 38, height: 38 }}>
                {activeMp.player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15 }}>
                  {activeMp.player.name}
                  {activeMp.player.jersey_number && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}> #{activeMp.player.jersey_number}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {activeMp.current_pos
                    ? <span className={`pp pp-${activeMp.current_pos}`}>{POSITION_LABELS[activeMp.current_pos]}</span>
                    : 'No position set'}
                </div>
              </div>
            </div>

            <div className="slbl">Position</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {(['F', 'M', 'D', 'G']).map(pos => (
                <button
                  key={pos}
                  className={`pbtn ${activeMp.current_pos === pos ? 'a' + pos : ''}`}
                  onClick={() => setPosition(pos)}
                >
                  {POSITION_LABELS[pos]}
                </button>
              ))}
            </div>

            {activeEntry ? (
              <>
                <div className="slbl">Stats — {POSITION_LABELS[activeEntry.position]}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 9, marginTop: 9 }}>
                  {activeDefs.map(s => {
                    if (s.type === 'rate') {
                      const hit = stats.find(st => st.position_entry_id === activeEntry.id && st.stat_key === s.key + '_hit')?.value || 0
                      const miss = stats.find(st => st.position_entry_id === activeEntry.id && st.stat_key === s.key + '_miss')?.value || 0
                      const tot = hit + miss
                      const rate = tot > 0 ? ((hit / tot) * 100).toFixed(1) + '%' : '—'
                      return (
                        <div key={s.key} className="sblk">
                          <div className="sblk-l">{s.label}</div>
                          <div className="sblk-v">{rate}</div>
                          <div className="sblk-s">{tot > 0 ? `${hit}/${tot} attempts` : ''}</div>
                          {[
                            { key: s.key + '_hit', label: s.hitL, val: hit },
                            { key: s.key + '_miss', label: s.missL, val: miss }
                          ].map(row => (
                            <div key={row.key} className="crow">
                              <span className="clbl">{row.label}</span>
                              <div className="cc">
                                <button className="cb minus" onClick={() => adjustStat(activeEntry.id, row.key, -1)}>−</button>
                                <span className="cv">{row.val}</span>
                                <button className="cb plus" onClick={() => adjustStat(activeEntry.id, row.key, 1)}>+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    const val = stats.find(st => st.position_entry_id === activeEntry.id && st.stat_key === s.key)?.value || 0
                    return (
                      <div key={s.key} className="sblk">
                        <div className="sblk-l">{s.label}</div>
                        <div className="sblk-v">{val}</div>
                        <div className="cc" style={{ marginTop: 8 }}>
                          <button className="cb minus" onClick={() => adjustStat(activeEntry.id, s.key, -1)}>−</button>
                          <span className="cv">{val}</span>
                          <button className="cb plus" onClick={() => adjustStat(activeEntry.id, s.key, 1)}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="nodata" style={{ padding: '.8rem 0' }}>Set a position to log stats</div>
            )}

            {prevEntries.length > 0 && (
              <>
                <div className="divider" />
                <div className="slbl">Previous positions</div>
                {prevEntries.map(e => (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 0', borderBottom: '1px solid var(--b3)',
                    fontSize: 12, color: 'var(--muted)'
                  }}>
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
