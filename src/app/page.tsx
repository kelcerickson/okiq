// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface Match {
  id: string
  opponent: string
  match_date: string
  location: string | null
  finished: boolean
  join_code: string
}

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const teamId = process.env.NEXT_PUBLIC_TEAM_ID

  useEffect(() => {
    loadMatches()
  }, [])

  async function loadMatches() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .order('match_date', { ascending: false })
    setMatches(data || [])
    setLoading(false)
  }

  return (
    <div className="shell">
      <header className="hdr">
        <Image src="/logo.png" alt="OK IQ" className="logo-img" width={120} height={56} style={{ height: 56, width: 'auto' }} />
      </header>
      <div className="body">
        <div className="home-hero">
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>Ready to track?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>Log stats live during a match</div>
          </div>
          <Link href="/match/new" className="btn btn-white">+ Log a match</Link>
        </div>

        <div className="slbl">Match history</div>
        {loading && <div className="nodata">Loading...</div>}
        {!loading && !matches.length && (
          <div className="nodata">No matches yet. Tap Log a match to get started.</div>
        )}
        {matches.map((m) => (
          <Link key={m.id} href={`/match/${m.id}`} className="mc-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15 }}>vs {m.opponent}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                  {m.match_date}{m.location ? ` · ${m.location}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, border: '1px solid', flexShrink: 0,
                ...(m.finished
                  ? { background: 'rgba(170,255,0,0.1)', color: '#AAFF00', borderColor: 'rgba(170,255,0,0.3)' }
                  : { background: 'rgba(255,140,66,0.1)', color: '#FF8C42', borderColor: 'rgba(255,140,66,0.35)' })
              }}>
                {m.finished ? 'Final' : 'Live'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 7 }}>
              Join code: <span style={{ color: 'var(--neon)', fontWeight: 500 }}>{m.join_code}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
