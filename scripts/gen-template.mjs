// scripts/gen-template.mjs — 기본 셋팅 게임 템플릿 생성기 (1회성). 사용: node scripts/gen-template.mjs <slug> "<이름>" "<키워드,쉼표>" "<프롬프트>"
// 결과: lib/studio/templates/<slug>.json  { slug, name, keywords, prompt, html }
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const [,, slug, name, keywordsCsv, prompt] = process.argv
if (!slug || !name || !keywordsCsv || !prompt) { console.error('usage: node scripts/gen-template.mjs <slug> <name> <k1,k2> <prompt>'); process.exit(1) }
const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
const key = envText.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim()
const promptSrc = fs.readFileSync(path.join(process.cwd(), 'lib/studio/prompt.ts'), 'utf8')
const SYSTEM_PROMPT = promptSrc.split('export const SYSTEM_PROMPT = `')[1].split('`\n')[0]

const client = new Anthropic({ apiKey: key })
const stream = client.messages.stream({ model: 'claude-sonnet-5', max_tokens: 64000, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: `요청: ${prompt}` }] })
let full = ''
for await (const chunk of stream) if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') full += chunk.delta.text
const open = full.indexOf('<game>'), close = full.indexOf('</game>')
if (open < 0 || close < 0) { console.error('no <game> in output'); process.exit(2) }
const html = full.slice(open + 6, close).trim()
const description = full.slice(0, open).trim()
const out = { slug, name, keywords: keywordsCsv.split(',').map((k) => k.trim()).filter(Boolean), prompt, description, html }
fs.writeFileSync(path.join(process.cwd(), 'lib/studio/templates', `${slug}.json`), JSON.stringify(out))
const fin = await stream.finalMessage()
console.log(`${slug}: ${html.length} chars, tokens in=${fin.usage?.input_tokens} out=${fin.usage?.output_tokens}`)
