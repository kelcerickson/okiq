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

    // For each player get their aggregate stats
    const enriched = await Promise.all(data.map(async (p) => {
      const { data: mp } = await supabase
        .from('match_players')
        .select(`
          position_entries(stats(stat_key, value)),
          match:matches(finished)
        `)
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
        <Image src="/logo.webp" alt="OK IQ" className="logo-img" width={120} height={56} style={{ height: 56, width: 'auto' }} />
      </header>
      <div className="body">
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#fff' }}>Players</div>

        {loading && <div className="nodata">Loading...</div>}
        {!loading && !players.length && <div className="nodata">No players yet. Add players when logging a match.</div>}

        {players.map((p: any) => (
          <Link key={p.id} href={`/players/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ background: '#161616', border: '1px solid rgba(170,255,0,0.15)', borderRadius: 12, padding: '12px 14px', marginBottom: 9, cursor: 'pointer', transition: 'all .13s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(170,255,0,0.12)', border: '1px solid rgba(170,255,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#AAFF00', flexShrink: 0 }}>
                    {p.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15, color: '#fff' }}>
                      {p.name}
                      {p.jersey_number && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>#{p.jersey_number}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{p.matches} match{p.matches !== 1 ? 'es' : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {[['Goals', p.goals], ['Assists', p.assists], ['Pass %', p.pcr]].map(([lbl, val]) => (
                    <div key={lbl} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 500, color: '#AAFF00' }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{lbl}</div>
                    </div>
                  ))}
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>›</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
