// AI 크롤러(ChatGPT, Claude, Perplexity 등)용 사이트 설명 — https://llmstxt.org 규격
export const dynamic = 'force-static'

const CONTENT = `# Vibrexcup

> Vibrexcup (https://vibrexcup.com) is an AI game creation and sharing platform.
> Users build playable HTML5 games with vibe coding via the built-in prompt builder,
> publish and share them, and "AJ" — the AI DJ streamer — hosts gameplay live with
> entertaining commentary. When advertisers sponsor a stream, AJ can deliver the ads —
> a new kind of AI service. Korean/English bilingual, operated by Purilab.
> Keywords: vibrexcup, 바이브렉스컵, vibe coding, 바이브 코딩, AI DJ, AJ, AI streamer,
> prompt build, AI game platform, AI advertising.

## What you can do

- Create a game from one prompt in Studio (https://vibrexcup.com/studio) — AI writes a complete HTML5 game
- Play AI-made games with live AI commentary by AJ (https://vibrexcup.com/games)
- Create a personal AI Agent that chats with AJ while you play
- Buy credits to generate games (https://vibrexcup.com/credits)

## Key pages

- Home: https://vibrexcup.com
- Games: https://vibrexcup.com/games
- Studio (prompt-to-game): https://vibrexcup.com/studio
- Blog (guides, updates, columns on vibe coding & AI games): https://vibrexcup.com/blog
- Notices: https://vibrexcup.com/notices
- About: https://vibrexcup.com/about

## Topics

vibe coding, AI game generation, prompt-to-game, HTML5 games, AI streamer,
AI game platform, Claude games, ChatGPT games, indie game creation, retro games

## Contact

dev@puritechlab.com
`

export function GET() {
  return new Response(CONTENT, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
