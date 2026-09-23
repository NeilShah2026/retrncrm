/**
 * Renders the Instagram post images in public/post_images/ from HTML.
 *
 * The earlier posts were made by hand, which meant the copy lived only inside
 * a PNG and the next post had to re-derive the layout. These are generated, so
 * a line can be rewritten and re-rendered in a second, and every slide in a
 * carousel is guaranteed to sit on the same grid.
 *
 *   node scripts/post-images.mjs              # everything
 *   node scripts/post-images.mjs missed       # one set
 *
 * Needs Playwright (the same dependency scripts/generate-ios-assets.mjs uses)
 * and a network connection, for Geist from Google Fonts.
 *
 * House style, matched to the posts that came before: 1080×1080 at 2× (so
 * 2160², what Instagram wants), near-black ground, the wordmark top-left, an
 * uppercase eyebrow, one very large headline, a supporting line, an optional
 * white product card, and retrncrm.com bottom-right. Colours are the dark-mode
 * tokens from src/index.css.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'post_images')

/* ---- The card bodies ------------------------------------------------- */

/** A row of the white product card. `mutedNess` fades later rows. */
const row = (left, right, opts = {}) => `
  <div class="row ${opts.last ? 'last' : ''} ${opts.sep ? 'sep' : ''}">
    <div class="row-left ${opts.strong ? 'strong' : ''}">${left}</div>
    <div class="row-right ${opts.strong ? 'strong' : ''}" style="${opts.dim ? `opacity:${opts.dim}` : ''}">${right}</div>
  </div>`

const ledger = `
  <div class="card-head"><span>A semester, counted</span><span>People</span></div>
  ${row('Career fair', '20')}
  ${row('Info sessions and panels', '12')}
  ${row('Coffee chats', '9')}
  ${row('Clubs, classes, parties', '15', { sep: true })}
  ${row('<b>Met</b>', '<b>56</b>', { strong: true })}
  ${row('<b>Could text today</b>', '<b class="hurt">4</b>', { strong: true, last: true })}`

const timeline = `
  ${row('Day 1', '“Great meeting you — let’s keep in touch!”')}
  ${row('Week 2', 'You’ll message them this weekend.', { dim: 0.8 })}
  ${row('Month 2', 'It’s been too long to just say hi now.', { dim: 0.6 })}
  ${row('Month 6', 'They don’t remember your name.', { dim: 0.42, last: true })}`

const never = `
  <div class="card-head"><span>Never happened</span><span></span></div>
  <div class="miss"><i></i>The intro you didn’t get around to asking for</div>
  <div class="miss"><i></i>“We’re hiring — want me to pass your résumé along?”</div>
  <div class="miss"><i></i>The recruiter who still remembered you in September</div>
  <div class="miss last"><i></i>The alum two years ahead of you, already inside</div>`

const capture = `
  <div class="capture">
    <div class="input">Priya, recruiter at Wayfair, career fair, follow up in 3 weeks</div>
    <div class="save">Save contact</div>
  </div>
  <div class="card-head cols"><span>Name</span><span>Met at</span><span>Last</span><span>Next</span></div>
  <div class="grid">
    <div><em class="av av-p">PR</em>Priya Raman</div><div>Career fair</div><div>today</div><div class="ok">in 3 weeks</div>
  </div>
  <div class="grid">
    <div><em class="av av-d">DO</em>David Osei</div><div>MIT hackathon</div><div>3mo</div><div class="due">overdue</div>
  </div>
  <div class="grid last">
    <div><em class="av av-m">MC</em>Marcus Cole</div><div>Alumni panel</div><div>5w</div><div class="ok">Friday</div>
  </div>`

/* ---- The slides ------------------------------------------------------ */

const SETS = {
  missed: [
    {
      file: 'missed-1-already-met.png',
      eyebrow: 'The part nobody warns you about',
      headline: 'You already met the person who could’ve gotten you the job.',
      size: 74,
      body: 'You just can’t remember their last name, where they ended up, or what you said you’d send them.',
      foot: 'Swipe →',
    },
    {
      file: 'missed-2-count-them.png',
      eyebrow: 'One normal semester',
      headline: '56 people met.<br />4 you could text today.',
      size: 78,
      body: 'Run the count on your own semester. It’s the second number that stings.',
      card: ledger,
    },
    {
      file: 'missed-3-how-it-goes.png',
      eyebrow: 'How it actually goes',
      headline: 'Nothing dramatic happens. That’s the problem.',
      size: 74,
      body: 'Every contact has a quiet expiry date, and nothing tells you when it passes.',
      card: timeline,
    },
    {
      file: 'missed-4-what-it-costs.png',
      eyebrow: 'What it actually costs',
      headline: 'The referral goes to whoever stayed in touch.',
      size: 74,
      body: 'None of this ever arrives as a rejection. It simply never happens, and you never find out.',
      card: never,
    },
    {
      file: 'missed-5-ten-seconds.png',
      eyebrow: 'Or: ten seconds, once',
      headline: 'Type it once. Retrn holds on to it.',
      size: 78,
      body: 'Plain words in, a real contact out — follow-up already set. Retrn tells you who’s gone quiet while it’s still easy to say hello.',
      card: capture,
    },
    {
      file: 'missed-6-start.png',
      eyebrow: 'Free for students',
      headline: 'Start with the next person you meet.',
      size: 78,
      body: 'Every paid feature is free with a verified @babson.edu email. Everyone else starts free for 30 contacts.',
      cta: 'Start free',
    },
  ],
}

/* ---- Page ------------------------------------------------------------ */

const page = (s) => `<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px; height: 1080px; background: #111113; overflow: hidden;
    font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .frame { display: flex; flex-direction: column; height: 100%; padding: 74px; }

  /* Wordmark — the app's Logo, inverted for the dark ground. */
  .logo { display: flex; align-items: center; gap: 15px; }
  .logo i {
    display: grid; place-items: center; width: 52px; height: 52px; border-radius: 14px;
    background: #fafafa; color: #18181b; font-size: 27px; font-weight: 600; font-style: normal;
  }
  .logo span { font-size: 33px; font-weight: 600; letter-spacing: -0.02em; color: #fff; }

  .main { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 34px 0; }
  .eyebrow {
    font-size: 15px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase;
    color: #8b8b94;
  }
  h1 {
    margin-top: 22px; font-size: ${s.size}px; line-height: 1.02; font-weight: 600;
    letter-spacing: -0.035em; color: #fff; max-width: 15.5ch;
  }
  .body {
    margin-top: 30px; font-size: 25px; line-height: 1.5; color: #9a9aa2; max-width: 27ch;
  }

  /* The product card: white, so the app reads as the one lit thing here. */
  .card { margin-top: 44px; background: #fff; border-radius: 16px; padding: 8px; }
  .card-inner { border: 1px solid #e2e2e4; border-radius: 10px; overflow: hidden; }
  .card-head {
    display: flex; justify-content: space-between; gap: 20px; padding: 13px 20px;
    background: #f7f7f8; border-bottom: 1px solid #ececee;
    font-size: 15px; font-weight: 500; color: #67676f;
  }
  .row {
    display: flex; justify-content: space-between; align-items: center; gap: 24px;
    padding: 17px 20px; border-bottom: 1px solid #ececee; font-size: 20px;
  }
  .row.last { border-bottom: 0; }
  /* The count's rule: itemised rows above, the two that matter below. */
  .row.sep { border-bottom: 2px solid #d5d5da; }
  .row-left { color: #4e4e56; }
  .row-right { color: #0e0e11; font-variant-numeric: tabular-nums; text-align: right; }
  .row-left.strong, .row-right.strong { color: #0e0e11; }
  .row b { font-weight: 600; }
  .hurt { color: #bd2828; }

  .miss {
    display: flex; align-items: center; gap: 14px; padding: 17px 20px;
    border-bottom: 1px solid #ececee; font-size: 20px; color: #67676f;
  }
  .miss.last { border-bottom: 0; }
  .miss i { flex: none; width: 15px; height: 15px; border: 1.5px solid #cfcfd4; border-radius: 999px; }

  .capture { display: flex; gap: 12px; padding: 16px; border-bottom: 1px solid #ececee; }
  .input {
    flex: 1; padding: 14px 16px; border: 1px solid #e2e2e4; border-radius: 8px;
    font-size: 19px; color: #8b8b94;
  }
  .save {
    padding: 14px 20px; border-radius: 8px; background: #18181b; color: #fafafa;
    font-size: 19px; font-weight: 600; white-space: nowrap;
  }
  .grid {
    display: grid; grid-template-columns: 1.5fr 1fr 0.6fr 0.8fr; align-items: center; gap: 20px;
    padding: 16px 20px; border-bottom: 1px solid #ececee; font-size: 19px; color: #67676f;
  }
  .grid.last { border-bottom: 0; }
  .grid > div:first-child { display: flex; align-items: center; gap: 12px; color: #0e0e11; font-weight: 500; }
  .av {
    display: grid; place-items: center; width: 34px; height: 34px; border-radius: 999px;
    font-size: 13px; font-style: normal; font-weight: 500;
  }
  .av-p { background: #fde8ef; color: #9d2b53; }
  .av-d { background: #e6f0fd; color: #1a4f9c; }
  .av-m { background: #e7f5ee; color: #1f6b4a; }
  .ok { color: #257e55; }
  .due { color: #bd2828; font-weight: 500; }
  .card-head.cols {
    display: grid; grid-template-columns: 1.5fr 1fr 0.6fr 0.8fr; gap: 20px; justify-content: initial;
  }

  .foot { display: flex; align-items: center; justify-content: space-between; }
  .cta {
    padding: 19px 38px; border-radius: 999px; background: #fff; color: #111113;
    font-size: 24px; font-weight: 600;
  }
  .note { font-size: 22px; color: #8b8b94; }
  .site { font-size: 22px; color: #8b8b94; margin-left: auto; }
</style></head>
<body><div class="frame">
  <div class="logo"><i>R</i><span>Retrn</span></div>
  <div class="main">
    <div class="eyebrow">${s.eyebrow}</div>
    <h1>${s.headline}</h1>
    <div class="body">${s.body}</div>
    ${s.card ? `<div class="card"><div class="card-inner">${s.card}</div></div>` : ''}
  </div>
  <div class="foot">
    ${s.cta ? `<div class="cta">${s.cta}</div>` : ''}
    ${s.foot ? `<div class="note">${s.foot}</div>` : ''}
    <div class="site">retrncrm.com</div>
  </div>
</div></body></html>`

/* ---- Render ---------------------------------------------------------- */

const only = process.argv[2]
const sets = only ? { [only]: SETS[only] } : SETS
if (only && !SETS[only]) {
  console.error(`No such set: ${only}. Try one of: ${Object.keys(SETS).join(', ')}`)
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })

for (const [name, slides] of Object.entries(sets)) {
  for (const slide of slides) {
    await tab.setContent(page(slide), { waitUntil: 'load' })
    await tab.evaluate(() => document.fonts.ready)
    await tab.screenshot({ path: join(OUT, slide.file) })
    console.log(`${name}  →  ${slide.file}`)
  }
}

await browser.close()
