'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NewMatch() {
  const router = useRouter()
  const teamId = process.env.NEXT_PUBLIC_TEAM_ID
  const [opponent, setOpponent] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [roster, setRoster] = useState<{ name: string; number: string }[]>([])
  const [newName, setNewName] = useState('')
  const [newNum, setNewNum] = useState('')
  const [saving, setSaving] = useState(false)

  function addPlayer() {
    if (!newName.trim()) return
    setRoster([...roster, { name: newName.trim(), number: newNum }])
    setNewName('')
    setNewNum('')
  }

  function removePlayer(i: number) {
    setRoster(roster.filter((_, idx) => idx !== i))
  }

  async function createMatch() {
    if (!opponent || !roster.length) {
      alert('Add an opponent and at least one player.')
      return
    }
    setSaving(true)

    // Create match
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .insert({ team_id: teamId, opponent, match_date: date, location: location || null })
      .select()
      .single()

    if (matchErr || !match) { alert('Error creating match'); setSaving(false); return }

    // Upsert players and create match_players
    for (const p of roster) {
      // Check if player exists
      let { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('team_id', teamId)
        .eq('name', p.name)
        .single()

      let playerId = existing?.id
      if (!playerId) {
        const { data: newPlayer } = await supabase
          .from('players')
          .insert({ team_id: teamId, name: p.name, jersey_number: p.number || null })
          .select('id')
          .single()
        playerId = newPlayer?.id
      }

      if (playerId) {
        await supabase.from('match_players').insert({ match_id: match.id, player_id: playerId })
      }
    }

    router.push(`/match/${match.id}/live`)
  }

  return (
    <div className="shell">
      <header className="hdr">
        <Link href="/" className="btn btn-ghost btn-sm">← Back</Link>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Log a match</span>
        <div />
      </header>
      <div className="body">
        <div className="card">
          <div style={{ marginBottom: 9 }}>
            <div className="slbl">Opponent</div>
            <input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="e.g. Meridian FC" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className="slbl">Date</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <div className="slbl">Location</div>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Field name" />
            </div>
          </div>
        </div>

        <div className="slbl" style={{ marginTop: 4 }}>Roster</div>
        {roster.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--b3)' }}>
            <div className="av" style={{ width: 28, height: 28, fontSize: 11 }}>
              {p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span style={{ flex: 1, fontSize: 13 }}>{p.name}{p.number && <span style={{ color: 'var(--muted)' }}> #{p.number}</span>}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => removePlayer(i)}>✕</button>
          </div>
        ))}

        <div className="fr" style={{ marginBottom: 13, marginTop: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Player name"
            style={{ flex: 1, minWidth: 100 }} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
          <input value={newNum} onChange={e => setNewNum(e.target.value)} placeholder="#"
            type="number" min="1" max="99" style={{ width: 56 }} />
          <button className="btn btn-sm btn-oneon" onClick={addPlayer}>+ Add</button>
        </div>

        <button className="btn btn-neon" style={{ width: '100%', justifyContent: 'center' }}
          onClick={createMatch} disabled={saving}>
          {saving ? 'Creating...' : 'Create match'}
        </button>
      </div>
    </div>
  )
}