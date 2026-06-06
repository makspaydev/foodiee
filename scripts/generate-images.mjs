#!/usr/bin/env node
/*
 * Generate AI food photos for Foodiee recipes.
 *
 * Provider is auto-detected from whichever key is set (override with IMAGE_PROVIDER):
 *   - Gemini  (GEMINI_API_KEY)  — Google AI Studio, model gemini-2.5-flash-image
 *   - OpenAI  (OPENAI_API_KEY)  — model gpt-image-1
 *
 * Keys are read from the environment OR from a local .env.local / .env file
 * (gitignored), e.g. a file containing:  GEMINI_API_KEY=AIza...
 *
 * Usage:
 *   node scripts/generate-images.mjs viral     # the 10 viral recipes (pilot)
 *   node scripts/generate-images.mjs all       # every recipe
 *   node scripts/generate-images.mjs id1,id2   # specific ids
 *
 * Output: public/images/<id>.<ext>  +  refreshes src/imageManifest.js
 */
import { writeFile, mkdir, readdir, readFile, unlink, rename } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { recipes } from '../src/recipes.js'

const ROOT = new URL('../', import.meta.url)
const OUT_DIR = new URL('public/images/', ROOT)
const MANIFEST = new URL('src/imageManifest.js', ROOT)

// --- load .env.local / .env (simple parser, no dependency) ---
for (const name of ['.env.local', '.env']) {
  try {
    const txt = await readFile(new URL(name, ROOT), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* file may not exist */
  }
}

// --- pick provider ---
const provider =
  process.env.IMAGE_PROVIDER ||
  (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : null)

if (!provider) {
  console.error('✗ No API key found. Put GEMINI_API_KEY=... in a .env.local file (gitignored).')
  process.exit(1)
}

// --- pick targets ---
const arg = (process.argv[2] || 'viral').trim()
let targets
if (arg === 'all') targets = recipes
else if (arg === 'viral') targets = recipes.filter((r) => r.tags.includes('viral'))
else {
  const ids = new Set(arg.split(',').map((s) => s.trim()))
  targets = recipes.filter((r) => ids.has(r.id))
}
if (!targets.length) {
  console.error(`✗ No recipes matched "${arg}".`)
  process.exit(1)
}

const prompt = (r) =>
  `Professional overhead food photography of "${r.title}", ${r.cuisine} cuisine. ` +
  `Beautifully plated and garnished on a clean light neutral background, soft natural ` +
  `lighting, shallow depth of field, fresh and appetising, realistic, high detail. ` +
  `No text, no labels, no hands, no people.`

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
const extFor = (mime) =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime] || 'png')

// --- provider calls: return { b64, mime } ---
async function genGemini(r) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt(r) }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
  const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
  if (!part) throw new Error('no image in response (possibly filtered)')
  return { b64: part.inlineData.data, mime: part.inlineData.mimeType || 'image/png' }
}

async function genOpenAI(r) {
  const model = process.env.IMAGE_MODEL || 'gpt-image-1'
  const body = { model, prompt: prompt(r), size: '1024x1024', n: 1 }
  if (model === 'gpt-image-1') {
    body.output_format = 'jpeg'
    body.output_compression = 80
  } else body.response_format = 'b64_json'
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('no image data returned')
  return { b64, mime: model === 'gpt-image-1' ? 'image/jpeg' : 'image/png' }
}

const generate = provider === 'gemini' ? genGemini : genOpenAI

// Save the image, optimising to a web-friendly JPEG via macOS `sips` when
// available (≈1.8MB PNG -> ≈280KB JPEG). Falls back to the raw file otherwise.
async function saveImage(id, buf, ext) {
  const tmp = new URL(`${id}.orig.${ext}`, OUT_DIR)
  await writeFile(tmp, buf)
  const jpg = `${id}.jpg`
  try {
    execFileSync(
      'sips',
      ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '900',
        fileURLToPath(tmp), '--out', fileURLToPath(new URL(jpg, OUT_DIR))],
      { stdio: 'ignore' },
    )
    await unlink(tmp).catch(() => {})
    return jpg
  } catch {
    const raw = `${id}.${ext}`
    await rename(tmp, new URL(raw, OUT_DIR)).catch(() => {})
    return raw
  }
}

await mkdir(OUT_DIR, { recursive: true })

// Skip recipes that already have an image (resumable + cheap). Use FORCE=1 to redo.
const force = process.env.FORCE === '1'
const existing = new Set(
  (await readdir(OUT_DIR))
    .map((f) => f.match(/^(.+)\.(png|jpg|jpeg|webp)$/)?.[1])
    .filter(Boolean),
)
const todo = force ? targets : targets.filter((r) => !existing.has(r.id))
const skipped = targets.length - todo.length

console.log(
  `Generating ${todo.length} image(s) via ${provider}` +
    (skipped ? ` (skipping ${skipped} already done; FORCE=1 to redo)` : '') +
    `…\n`,
)

let ok = 0
let failed = 0
for (const r of todo) {
  let attempt = 0
  while (true) {
    try {
      const { b64, mime } = await generate(r)
      // remove any stale file for this id, then write the new one
      for (const e of ['png', 'jpg', 'jpeg', 'webp']) {
        await unlink(new URL(`${r.id}.${e}`, OUT_DIR)).catch(() => {})
      }
      const file = await saveImage(r.id, Buffer.from(b64, 'base64'), extFor(mime))
      ok++
      console.log(`✓ ${r.id}  (${file})`)
      break
    } catch (err) {
      attempt++
      const retryable = /429|rate|quota|5\d\d|timeout|fetch failed/i.test(err.message)
      if (retryable && attempt < 4) {
        const wait = 2000 * attempt
        console.log(`  …${r.id} retry ${attempt} in ${wait / 1000}s (${err.message})`)
        await sleep(wait)
        continue
      }
      failed++
      console.error(`✗ ${r.id}: ${err.message}`)
      break
    }
  }
  await sleep(1500) // gentle throttle for free-tier rate limits
}

// --- refresh manifest map { id: filename } from whatever files exist ---
const files = await readdir(OUT_DIR)
const map = {}
for (const f of files.sort()) {
  const m = f.match(/^(.+)\.(png|jpg|jpeg|webp)$/)
  if (m) map[m[1]] = f
}
await writeFile(
  MANIFEST,
  `// Auto-generated by scripts/generate-images.mjs — maps recipe id -> image filename\n` +
    `// in public/images/. Do not edit by hand; re-run the image script.\n` +
    `export const IMAGES = ${JSON.stringify(map, null, 2)}\n`,
)

console.log(`\nDone: ${ok} generated, ${failed} failed. ${Object.keys(map).length} total image(s).`)
