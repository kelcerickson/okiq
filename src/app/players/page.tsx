// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function PlayersPage() {
  const teamId = process.env.NEXT_PUBLIC_TEAM_ID
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data } = await supabase
      .from('players')
      .select('id, name, jersey_number')
      .eq('team_id', teamId)
      .order('name')

    if (!data) { setLoading(false); return }

    const enriched = await Promise.all(data.map(async (p) => {
      const { data: mp } = await supabase
        .from('match_players')
        .select(`position_entries(stats(stat_key, value)), match:matches(finished)`)
        .eq('player_id', p.id)

      let goals = 0, assists = 0, pcrHit = 0, pcrMiss = 0, matches = 0
      for (const m of mp || []) {
        if (!m.match?.finished) continue
        matches++
        for (const pe of m.position_entries || []) {
          for (const s of pe.stats || []) {
            if (s.stat_key === 'goals') goals += s.value
            if (s.stat_key === 'assists') assists += s.value
            if (s.stat_key === 'pcr_hit') pcrHit += s.value
            if (s.stat_key === 'pcr_miss') pcrMiss += s.value
          }
        }
      }
      const pcr = pcrHit + pcrMiss > 0 ? ((pcrHit / (pcrHit + pcrMiss)) * 100).toFixed(0) + '%' : '—'
      return { ...p, goals, assists, pcr, matches }
    }))

    setPlayers(enriched)
    setLoading(false)
  }

  return (
    <div className="shell">
      <header className="hdr">
        <Image src="/logo.png" alt="OK IQ" className="logo-img" width={120} height={52} style={{ height: 52, width: 'auto' }} />
      </header>
      <div className="body">
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>Players</div>

        {loading && <div className="nodata">Loading...</div>}
        {!loading && !players.length && (
          <div className="nodata">No players yet. Add players when logging a match.</div>
        )}

        {players.map((p) => (
          <Link key={p.id} href={`/players/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all .13s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1E1E1E', border: '2px solid #AAFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#AAFF00', flexShrink: 0 }}>
                    {p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#1A1A1A' }}>
                      {p.name}
                      {p.jersey_number && <span style={{ fontSize: 13, color: '#888', marginLeft: 6 }}>#{p.jersey_number}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{p.matches} match{p.matches !== 1 ? 'es' : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {[['Goals', p.goals], ['Assists', p.assists], ['Pass %', p.pcr]].map(([lbl, val]) => (
                    <div key={lbl} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A' }}>{val}</div>
                      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '.03em' }}>{lbl}</div>
                    </div>
                  ))}
                  <span style={{ color: '#CCC', fontSize: 18 }}>›</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
