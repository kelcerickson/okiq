import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { playerName, matchHistory, mode } = await req.json()

    let prompt = ''

    if (mode === 'drills') {
      // Suggested drills mode — personalized, pro-sourced, age-appropriate
      prompt = `You are an encouraging youth soccer coach giving advice to an 11-year-old girl named ${playerName.split(' ')[0]}.

Her recent stats show these are her top areas to improve:
${JSON.stringify(matchHistory, null, 2)}

Give her 3 specific, fun drills she can do to improve. Each drill should:
- Have a cool name (like a pro player or team inspired name)
- Take 10-15 minutes
- Use simple equipment (cones, a ball, a wall)
- Sound exciting and achievable for an 11 year old
- Reference a real pro player or coach who uses this technique

Keep the language super simple — like you're talking directly to her. Be encouraging and fun!

Respond ONLY in JSON, no markdown:
{
  "intro": "1 sentence hype intro for ${playerName.split(' ')[0]} (keep it fun and encouraging)",
  "drills": [
    {
      "name": "drill name (inspired by a pro)",
      "pro": "Name of pro player or coach who uses this",
      "proTip": "What that pro says about this skill (1 simple sentence)",
      "whatToDo": "Simple 2-3 sentence description of the drill",
      "time": "10 min",
      "equipment": "what you need",
      "makeItFun": "a fun challenge or game to make it more exciting"
    }
  ]
}`
    } else {
      // Regular analysis mode — concise, age-appropriate
      prompt = `You are an encouraging youth soccer coach. Keep ALL responses super simple — like talking to an 11-year-old girl.

Player: ${playerName.split(' ')[0]}
Match data: ${JSON.stringify(matchHistory, null, 2)}

Be brief, positive, and specific. Use simple words. Max 1 short sentence per point.

Respond ONLY in JSON, no markdown:
{
  "summary": "1 fun encouraging sentence about how she's doing overall",
  "strengths": ["short simple strength 1", "short simple strength 2", "short simple strength 3"],
  "improvements": ["simple area 1", "simple area 2"],
  "tip": "1 simple thing to try at next practice (talk directly to her)"
}`
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('')
    const result = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI coach error:', error)
    return NextResponse.json({ error: 'Analysis unavailable' }, { status: 500 })
  }
}
