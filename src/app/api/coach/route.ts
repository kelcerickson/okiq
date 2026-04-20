import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { playerName, matchHistory } = await req.json()

    const prompt = `You are an expert youth soccer coach. Be encouraging, specific, and actionable. Ages 9-16.
Player: ${playerName}
Matches (${matchHistory.length}):
${JSON.stringify(matchHistory, null, 2)}
Respond ONLY in JSON, no markdown:
{"summary":"2-3 sentences mentioning trends if multiple matches","strengths":["s1","s2","s3"],"improvements":["a1","a2"],"tip":"one concrete drill"}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
    const insight = JSON.parse(text.replace(/```json|```/g, '').trim())

    return NextResponse.json(insight)
  } catch (error) {
    console.error('AI coach error:', error)
    return NextResponse.json({ error: 'Analysis unavailable' }, { status: 500 })
  }
}
