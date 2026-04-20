// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const teamId = process.env.NEXT_PUBLIC_TEAM_ID

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .order('match_date', { ascending: false })
    setMatches(data || [])
    setLoading(false)
  }

  const resultColors = {
    W: { bg: '#AAFF00', text: '#1A1A1A', label: 'W' },
    L: { bg: '#FF4444', text: '#fff', label: 'L' },
    D: { bg: '#888', text: '#fff', label: 'D' },
  }

  return (
    <div className="shell">
      <header className="hdr">
        <Image src="/logo.png" alt="OK IQ" className="logo-img" width={120} height={52} style={{ height: 52, width: 'auto' }} />
      </header>
      <div className="body">
        <div className="home-hero">
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>Ready to track?</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>Log stats live during a match</div>
          </div>
          <Link href="/match/new" className="btn btn-white">+ Log a match</Link>
        </div>

        <div className="slbl">Match history</div>
        {loading && <div className="nodata">Loading...</div>}
        {!loading && !matches.length && <div className="nodata">No matches yet. Tap Log a match to get started.</div>}

        {matches.map(m => (
          <div key={m.id} className="mc-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* W/L/D badge */}
                  {m.result && (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: resultColors[m.result]?.bg, color: resultColors[m.result]?.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
                      {resultColors[m.result]?.label}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#1A1A1A' }}>vs {m.opponent}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{m.match_date}{m.location ? ` · ${m.location}` : ''}</div>
                  </div>
                </div>

                {/* Score */}
                {m.our_score !== null && m.our_score !== undefined && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>{m.our_score}</span>
                    <span style={{ fontSize: 16, color: '#888', fontWeight: 500 }}>—</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>{m.their_score}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, border: '1px solid', ...(m.finished ? { background: 'rgba(170,255,0,0.1)', color: '#2A6600', borderColor: 'rgba(170,255,0,0.4)' } : { background: 'rgba(255,140,66,0.1)', color: '#B85000', borderColor: 'rgba(255,140,66,0.35)' }) }}>
                  {m.finished ? 'Final' : 'Live'}
                </span>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {!m.finished && (
                    <Link href={`/match/${m.id}/live`} className="btn btn-neon btn-sm">Resume</Link>
                  )}
                  {m.finished && (
                    <Link href={`/match/${m.id}/live`} className="btn btn-sm" style={{ background: '#1E1E1E', color: '#AAFF00', border: '1px solid rgba(170,255,0,0.3)', fontSize: 12 }}>Edit match</Link>
                  )}
                  <Link href={`/match/${m.id}`} className="btn btn-ghost btn-sm">Analytics →</Link>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#AAA', marginTop: 8 }}>{m.players_count || ''} {m.join_code && <span>· Code: <strong style={{ color: '#AAFF00' }}>{m.join_code}</strong></span>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
