// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function TeamPage() {
  const teamId = process.env.NEXT_PUBLIC_TEAM_ID
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState([])
  const [stats, setStats] = useState({
    totalMatches: 0, totalGoals: 0, totalAssists: 0,
    totalTackles: 0, totalInterceptions: 0, totalShotsOnTarget: 0,
    avgPassCompletion: null, avgDribbleSuccess: null, avgSavePct: null,
    topScorer: null, topAssister: null, topTackler: null,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: matchData } = await supabase
      .from('matches')
      .select(`id, opponent, match_date, finished,
        match_players(id, player_id,
          player:players(id, name, jersey_number),
          position_entries(id, position, stats(stat_key, value)))`)
      .eq('team_id', teamId)
      .eq('finished', true)
      .order('match_date', { ascending: false })

    if (!matchData) { setLoading(false); return }
    setMatches(matchData)

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
          const get = (key) => pe.stats?.find(x => x.stat_key === key)?.value || 0
          const g = get('goals'); totalGoals += g; playerTotals[pid].goals += g
          const a = get('assists'); totalAssists += a; playerTotals[pid].assists += a
          const t = get('tackles'); totalTackles += t; playerTotals[pid].tackles += t
          totalInts += get('interceptions')
          totalSOT += get('sot')
          pcrHit += get('pcr_hit'); pcrMiss += get('pcr_miss')
          dsrHit += get('dsr_hit'); dsrMiss += get('dsr_miss')
          saveTotal += get('saves'); gaTotal += get('ga')
        }
      }
    }

    const players = Object.values(playerTotals)
    const topScorer = [...players].sort((a, b) => b.goals - a.goals)[0] || null
    const topAssister = [...players].sort((a, b) => b.assists - a.assists)[0] || null
    const topTackler = [...players].sort((a, b) => b.tackles - a.tackles)[0] || null

    setStats({
      totalMatches: matchData.length, totalGoals, totalAssists, totalTackles,
      totalInterceptions: totalInts, totalShotsOnTarget: totalSOT,
      avgPassCompletion: pcrHit + pcrMiss > 0 ? (pcrHit / (pcrHit + pcrMiss)) * 100 : null,
      avgDribbleSuccess: dsrHit + dsrMiss > 0 ? (dsrHit / (dsrHit + dsrMiss)) * 100 : null,
      avgSavePct: saveTotal + gaTotal > 0 ? (saveTotal / (saveTotal + gaTotal)) * 100 : null,
      topScorer, topAssister, topTackler,
    })
    setLoading(false)
  }

  const StatCard = ({ label, value }) => (
    <div style={{ background: '#1E1E1E', borderRadius: 10, padding: '12px 10px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#AAFF00' }}>{value ?? '—'}</div>
    </div>
  )

  const LeaderCard = ({ label, player, stat }) => (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 14px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, fontWeight: 600 }}>{label}</div>
      {player ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1E1E1E', border: '2px solid #AAFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#AAFF00' }}>
            {player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{player.name}</div>
            <div style={{ fontSize: 14, color: '#AAFF00', fontWeight: 600, marginTop: 2 }}>{stat}</div>
          </div>
        </div>
      ) : <div style={{ fontSize: 13, color: '#AAA' }}>No data yet</div>}
    </div>
  )

  return (
    <div className="shell">
      <header className="hdr">
        <Image src="/logo.png" alt="OK IQ" className="logo-img" width={120} height={52} style={{ height: 52, width: 'auto' }} />
      </header>
      <div className="body">
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>Team analytics</div>

        {loading && <div className="nodata">Loading...</div>}

        {!loading && stats.totalMatches === 0 && (
          <div className="nodata">No finished matches yet. Complete a match to see team analytics.</div>
        )}

        {!loading && stats.totalMatches > 0 && (
          <>
            <div className="slbl">Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
              <StatCard label="Matches" value={stats.totalMatches} />
              <StatCard label="Goals" value={stats.totalGoals} />
              <StatCard label="Assists" value={stats.totalAssists} />
              <StatCard label="Shots on target" value={stats.totalShotsOnTarget} />
              <StatCard label="Tackles" value={stats.totalTackles} />
              <StatCard label="Interceptions" value={stats.totalInterceptions} />
            </div>

            <div className="slbl">Team averages</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
              <StatCard label="Pass %" value={stats.avgPassCompletion !== null ? stats.avgPassCompletion.toFixed(1) + '%' : '—'} />
              <StatCard label="Dribble %" value={stats.avgDribbleSuccess !== null ? stats.avgDribbleSuccess.toFixed(1) + '%' : '—'} />
              <StatCard label="Save %" value={stats.avgSavePct !== null ? stats.avgSavePct.toFixed(1) + '%' : '—'} />
            </div>

            <div className="slbl">Team leaders</div>
            <LeaderCard label="Top scorer" player={stats.topScorer} stat={`${stats.topScorer?.goals} goals`} />
            <LeaderCard label="Top assists" player={stats.topAssister} stat={`${stats.topAssister?.assists} assists`} />
            <LeaderCard label="Top tackler" player={stats.topTackler} stat={`${stats.topTackler?.tackles} tackles`} />

            <div className="slbl" style={{ marginTop: 18 }}>Match history</div>
            {matches.map((m) => (
              <div key={m.id} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#1A1A1A' }}>vs {m.opponent}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{m.match_date}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
