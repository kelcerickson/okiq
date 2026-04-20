// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase, STAT_DEFS } from '@/lib/supabase'

export default function TeamPage() {
  const teamId = process.env.NEXT_PUBLIC_TEAM_ID
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState([])
  const [stats, setStats] = useState({
    totalMatches: 0,
    totalGoals: 0,
    totalAssists: 0,
    totalTackles: 0,
    totalInterceptions: 0,
    totalShotsOnTarget: 0,
    avgPassCompletion: null,
    avgDribbleSuccess: null,
    avgSavePct: null,
    topScorer: null,
    topAssister: null,
    topTackler: null,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: matchData } = await supabase
      .from('matches')
      .select(`
        id, opponent, match_date, finished,
        match_players(
          id, player_id,
          player:players(id, name, jersey_number),
          position_entries(id, position, stats(stat_key, value))
        )
      `)
      .eq('team_id', teamId)
      .eq('finished', true)
      .order('match_date', { ascending: false })

    if (!matchData) { setLoading(false); return }
    setMatches(matchData)

    // Aggregate stats
    const playerTotals = {}

    let totalGoals = 0, totalAssists = 0, totalTackles = 0
    let totalInts = 0, totalSOT = 0
    let pcrHit = 0, pcrMiss = 0, dsrHit = 0, dsrMiss = 0
    let saveTotal = 0, gaTotal = 0

    for (const m of matchData) {
      for (const mp of m.match_players || []) {
        const pid = mp.player_id
        if (!playerTotals[pid]) playerTotals[pid] = { name: mp.player?.name, goals: 0, assists: 0, tackles: 0 }

        for (const pe of mp.position_entries || []) {
          const s = pe.stats || []
          const get = (key) => s.find(x => x.stat_key === key)?.value || 0

          const goals = get('goals'); totalGoals += goals; playerTotals[pid].goals += goals
          const assists = get('assists'); totalAssists += assists; playerTotals[pid].assists += assists
          const tackles = get('tackles'); totalTackles += tackles; playerTotals[pid].tackles += tackles
          totalInts += get('interceptions')
          totalSOT += get('sot')
          pcrHit += get('pcr_hit'); pcrMiss += get('pcr_miss')
          dsrHit += get('dsr_hit'); dsrMiss += get('dsr_miss')
          saveTotal += get('saves'); gaTotal += get('ga')
        }
      }
    }

    const players = Object.values(playerTotals) as any[]
    const topScorer = players.sort((a, b) => b.goals - a.goals)[0] || null
    const topAssister = [...players].sort((a, b) => b.assists - a.assists)[0] || null
    const topTackler = [...players].sort((a, b) => b.tackles - a.tackles)[0] || null

    setStats({
      totalMatches: matchData.length,
      totalGoals,
      totalAssists,
      totalTackles,
      totalInterceptions: totalInts,
      totalShotsOnTarget: totalSOT,
      avgPassCompletion: pcrHit + pcrMiss > 0 ? ((pcrHit / (pcrHit + pcrMiss)) * 100) : null,
      avgDribbleSuccess: dsrHit + dsrMiss > 0 ? ((dsrHit / (dsrHit + dsrMiss)) * 100) : null,
      avgSavePct: saveTotal + gaTotal > 0 ? ((saveTotal / (saveTotal + gaTotal)) * 100) : null,
      topScorer,
      topAssister,
      topTackler,
    })
    setLoading(false)
  }

  const StatCard = ({ label, value }: { label: string, value: any }) => (
    <div style={{ background: '#1C1C1C', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: '#AAFF00' }}>{value ?? '—'}</div>
    </div>
  )

  const LeaderCard = ({ label, player, stat }: any) => (
    <div style={{ background: '#1C1C1C', border: '1px solid rgba(170,255,0,0.15)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{label}</div>
      {player ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(170,255,0,0.12)', border: '1px solid rgba(170,255,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#AAFF00' }}>
            {player.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{player.name}</div>
            <div style={{ fontSize: 13, color: '#AAFF00', fontWeight: 500 }}>{stat}</div>
          </div>
        </div>
      ) : <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>No data yet</div>}
    </div>
  )

  return (
    <div className="shell">
      <header className="hdr">
        <Image src="/logo.webp" alt="OK IQ" className="logo-img" width={120} height={56} style={{ height: 56, width: 'auto' }} />
      </header>
      <div className="body">
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#fff' }}>Team analytics</div>

        {loading && <div className="nodata">Loading...</div>}

        {!loading && stats.totalMatches === 0 && (
          <div className="nodata">No finished matches yet. Complete a match to see team analytics.</div>
        )}

        {!loading && stats.totalMatches > 0 && (
          <>
            <div className="slbl">Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <StatCard label="Matches" value={stats.totalMatches} />
              <StatCard label="Goals" value={stats.totalGoals} />
              <StatCard label="Assists" value={stats.totalAssists} />
              <StatCard label="Shots on target" value={stats.totalShotsOnTarget} />
              <StatCard label="Tackles" value={stats.totalTackles} />
              <StatCard label="Interceptions" value={stats.totalInterceptions} />
            </div>

            <div className="slbl">Team averages</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <StatCard label="Pass %" value={stats.avgPassCompletion !== null ? stats.avgPassCompletion.toFixed(1) + '%' : '—'} />
              <StatCard label="Dribble %" value={stats.avgDribbleSuccess !== null ? stats.avgDribbleSuccess.toFixed(1) + '%' : '—'} />
              <StatCard label="Save %" value={stats.avgSavePct !== null ? stats.avgSavePct.toFixed(1) + '%' : '—'} />
            </div>

            <div className="slbl">Team leaders</div>
            <LeaderCard label="Top scorer" player={stats.topScorer} stat={`${stats.topScorer?.goals} goals`} />
            <LeaderCard label="Top assists" player={stats.topAssister} stat={`${stats.topAssister?.assists} assists`} />
            <LeaderCard label="Top tackler" player={stats.topTackler} stat={`${stats.topTackler?.tackles} tackles`} />

            <div className="slbl" style={{ marginTop: 16 }}>Match history</div>
            {matches.map((m: any) => (
              <div key={m.id} style={{ background: '#161616', border: '1px solid rgba(170,255,0,0.15)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: '#fff' }}>vs {m.opponent}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{m.match_date}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
