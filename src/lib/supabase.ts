import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Position = 'F' | 'M' | 'D' | 'G'

export const POSITION_LABELS: Record<Position, string> = {
  F: 'Forward',
  M: 'Midfielder',
  D: 'Defender',
  G: 'Goalkeeper',
}

export const STAT_DEFS: Record<Position, Array<{ key: string; label: string; type: 'rate' | 'count'; hitL?: string; missL?: string }>> = {
  F: [
    { key: 'pcr', label: 'Pass completion', type: 'rate', hitL: 'Completed', missL: 'Missed' },
    { key: 'sot', label: 'Shots on target', type: 'count' },
    { key: 'dsr', label: 'Dribble success', type: 'rate', hitL: 'Success', missL: 'Failed' },
    { key: 'goals', label: 'Goals', type: 'count' },
    { key: 'assists', label: 'Assists', type: 'count' },
    { key: 'tackles', label: 'Tackles', type: 'count' },
    { key: 'interceptions', label: 'Interceptions', type: 'count' },
  ],
  M: [
    { key: 'pcr', label: 'Pass completion', type: 'rate', hitL: 'Completed', missL: 'Missed' },
    { key: 'sot', label: 'Shots on target', type: 'count' },
    { key: 'dsr', label: 'Dribble success', type: 'rate', hitL: 'Success', missL: 'Failed' },
    { key: 'goals', label: 'Goals', type: 'count' },
    { key: 'assists', label: 'Assists', type: 'count' },
    { key: 'tackles', label: 'Tackles', type: 'count' },
    { key: 'interceptions', label: 'Interceptions', type: 'count' },
  ],
  D: [
    { key: 'pcr', label: 'Pass completion', type: 'rate', hitL: 'Completed', missL: 'Missed' },
    { key: 'dsr', label: 'Dribble success', type: 'rate', hitL: 'Success', missL: 'Failed' },
    { key: 'tackles', label: 'Tackles', type: 'count' },
    { key: 'interceptions', label: 'Interceptions', type: 'count' },
  ],
  G: [
    { key: 'saves', label: 'Saves', type: 'count' },
    { key: 'ga', label: 'Goals allowed', type: 'count' },
  ],
}
