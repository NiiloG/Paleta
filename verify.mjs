import { firefox } from '/home/niels/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'fs'

const BASE  = 'http://localhost:3000'
const SS    = '/home/niels/Documents/programs/padeljavea/verify_screenshots'
mkdirSync(SS, { recursive: true })

const ok   = m => console.log(`  ✅  ${m}`)
const fail = m => console.log(`  ❌  ${m}`)
const warn = m => console.log(`  ⚠️   ${m}`)
const prob = m => console.log(`  🔍  ${m}`)
const hdr  = m => console.log(`\n${'─'.repeat(60)}\n  ${m}\n${'─'.repeat(60)}`)

const consoleErrors = []
const findings = []

async function shot(page, name) {
  await page.screenshot({ path: `${SS}/${name}.png`, fullPage: false })
}

async function run() {
  console.log('\n  paleta — Pre-deployment verification\n')

  const browser = await firefox.launch({ headless: true })

  // ── DESKTOP (1280×800) ───────────────────────────────────────────────────
  hdr('DESKTOP (1280×800)')
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const dp   = await desk.newPage()
  dp.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[desktop] ${m.text()}`) })
  dp.on('pageerror', e => consoleErrors.push(`[desktop] pageerror: ${e.message}`))

  // 1. Sign-in page
  hdr('1 — Sign-in page (/)')
  await dp.goto(BASE, { waitUntil: 'networkidle' })
  await shot(dp, '01_signin_desktop')
  const videoEl    = await dp.locator('video').count()
  const forgotLink = await dp.locator('a[href="/forgot-password"]').count()
  const contactLink = await dp.locator('a[href^="mailto:"]').count()
  videoEl     ? ok(`Video element present`) : fail('No video element')
  forgotLink  ? ok('"Forgot password?" link present') : fail('"Forgot password?" link missing')
  contactLink ? ok('Contact support mailto link present') : fail('Contact support link missing')

  // Check forgot link is below the sign-in button
  const btnBox    = await dp.locator('button[type="submit"]').boundingBox()
  const forgotBox = await dp.locator('a[href="/forgot-password"]').boundingBox()
  if (btnBox && forgotBox) {
    forgotBox.y > btnBox.y
      ? ok('Forgot password is below sign-in button')
      : fail('Forgot password is NOT below sign-in button')
  }

  // 2. Registration
  hdr('2 — Registration (/registreren)')
  await dp.goto(`${BASE}/registreren`, { waitUntil: 'networkidle' })
  await shot(dp, '02_register_desktop')
  const levelBtns = await dp.locator('button[type="button"]').count()
  levelBtns >= 4 ? ok(`${levelBtns} level buttons found`) : fail(`Only ${levelBtns} level buttons`)
  const formFields = await dp.locator('input[name="voornaam"], input[name="achternaam"], input[name="email"], input[name="wachtwoord"]').count()
  formFields === 4 ? ok('All 4 form fields present') : fail(`Only ${formFields}/4 form fields`)

  // 3. Forgot password
  hdr('3 — Forgot password (/forgot-password)')
  await dp.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' })
  await shot(dp, '03_forgot_desktop')
  const emailInput  = await dp.locator('input[type="email"]').count()
  const submitBtn   = await dp.locator('button[type="submit"]').count()
  emailInput ? ok('Email input present') : fail('Email input missing')
  submitBtn  ? ok('Submit button present') : fail('Submit button missing')

  // Test the confirmation state
  await dp.fill('input[type="email"]', 'test@example.com')
  await dp.click('button[type="submit"]')
  await dp.waitForTimeout(2000)
  await shot(dp, '03b_forgot_sent_desktop')
  const sentMsg = await dp.locator('text=Check your inbox').count()
  sentMsg ? ok('Confirmation "Check your inbox" shown after submit') : warn('Confirmation message not found — may need Supabase config')

  // 4. Events list
  hdr('4 — Events list (/events)')
  await dp.goto(`${BASE}/events`, { waitUntil: 'networkidle' })
  await shot(dp, '04_events_desktop')
  const eventCards = await dp.locator('a[href^="/events/"]').count()
  eventCards > 0 ? ok(`${eventCards} event card(s) visible`) : warn('No event cards — database may be empty')
  const upcomingHdr = await dp.locator('text=Upcoming').count()
  const pastHdr     = await dp.locator('text=Past events').count()
  upcomingHdr ? ok('"Upcoming" section header present') : prob('No "Upcoming" section (may be empty)')
  pastHdr     ? ok('"Past events" section header present') : prob('No "Past events" section (may be empty)')

  // 5. Event detail — find a real event to test
  hdr('5 — Event detail (/events/[id])')
  const firstEventHref = await dp.locator('a[href^="/events/"]').first().getAttribute('href')
  if (firstEventHref && firstEventHref !== '/events/create') {
    await dp.goto(`${BASE}${firstEventHref}`, { waitUntil: 'networkidle' })
    await shot(dp, '05_event_detail_desktop')

    // Check header structure — date line + location line
    const americanoBadge = await dp.locator('text=Americano').count()
    americanoBadge ? ok('"Americano" label present') : fail('"Americano" label missing')

    // Gold location line — look for text-xl element with gold color
    const locationLine = await dp.locator('p.text-xl').first()
    const locationVisible = await locationLine.count()
    if (locationVisible) {
      const style = await locationLine.getAttribute('style')
      style?.includes('#f5a623')
        ? ok('Location line is gold (#f5a623)')
        : fail(`Location line style: ${style}`)
      const fontSize = await locationLine.evaluate(el => window.getComputedStyle(el).fontSize)
      ok(`Location line font size: ${fontSize}`)
    } else {
      fail('Gold location/courts line (text-xl) not found')
    }

    // Check location line is below the date line
    const dateLine      = await dp.locator('p.text-sm').first().boundingBox()
    const locationBox   = await dp.locator('p.text-xl').first().boundingBox()
    if (dateLine && locationBox) {
      locationBox.y > dateLine.y
        ? ok('Location line is below date line')
        : fail('Location line is NOT below date line')
    }

    // Rating ranking (only on finalized events)
    const rankingSection = await dp.locator('text=Rating ranking').count()
    rankingSection ? ok('Rating ranking section present') : prob('No rating ranking — event may not be finalized')

    // Draw rounds
    const roundSection = await dp.locator('text=Draw').count()
    roundSection ? ok('Draw section present') : prob('No draw section — may be unfinalized event')

  } else {
    warn('No event detail page to test — no events in database')
  }

  // 6. Dashboard
  hdr('6 — Dashboard (/dashboard)')
  // Dashboard requires auth — check redirect
  await dp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await shot(dp, '06_dashboard_desktop')
  const redirectedToLogin = dp.url().includes('login') || dp.url() === `${BASE}/` || dp.url() === BASE
  if (redirectedToLogin) {
    ok('Unauthenticated → redirected to login (correct)')
    prob('Cannot test dashboard tabs without a logged-in session — manual check required')
  } else {
    const overviewTab  = await dp.locator('text=Overview').count()
    const historyTab   = await dp.locator('text=History').count()
    const settingsTab  = await dp.locator('text=Settings').count()
    overviewTab ? ok('Overview tab present') : fail('Overview tab missing')
    historyTab  ? ok('History tab present')  : fail('History tab missing')
    settingsTab ? ok('Settings tab present') : fail('Settings tab missing')
  }

  // 7. Player rankings
  hdr('7 — Player rankings (/spelers)')
  await dp.goto(`${BASE}/spelers`, { waitUntil: 'networkidle' })
  await shot(dp, '07_rankings_desktop')
  const rankTable = await dp.locator('table').count()
  const rankRows  = await dp.locator('tbody tr').count()
  rankTable ? ok('Rankings table present') : fail('Rankings table missing')
  rankRows  > 0 ? ok(`${rankRows} player row(s) in leaderboard`) : warn('No players in leaderboard')
  const cols = ['Rank', 'Player', 'Rating', 'Played', 'W / L', 'Win%']
  for (const col of cols) {
    const found = await dp.locator(`th:has-text("${col}")`).count()
    found ? ok(`Column "${col}" present`) : fail(`Column "${col}" missing`)
  }

  // 8. Update password
  hdr('8 — Update password (/update-password)')
  await dp.goto(`${BASE}/update-password`, { waitUntil: 'networkidle' })
  await shot(dp, '08_update_password_desktop')
  const pwInputs = await dp.locator('input[type="password"]').count()
  pwInputs === 2 ? ok('Both password fields present') : fail(`Expected 2 password inputs, found ${pwInputs}`)
  const pwBtn = await dp.locator('button[type="submit"]').count()
  pwBtn ? ok('Submit button present') : fail('Submit button missing')

  await desk.close()

  // ── MOBILE (375×812) ────────────────────────────────────────────────────
  hdr('MOBILE (375×812 — iPhone 14)')
  const mob = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const mp  = await mob.newPage()
  mp.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[mobile] ${m.text()}`) })
  mp.on('pageerror', e => consoleErrors.push(`[mobile] pageerror: ${e.message}`))

  // Sign-in — video must be hidden
  hdr('Mobile — Sign-in page')
  await mp.goto(BASE, { waitUntil: 'networkidle' })
  await shot(mp, '09_signin_mobile')
  const mVideoVisible = await mp.locator('video').evaluate(el => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  }).catch(() => false)
  !mVideoVisible ? ok('Video hidden on mobile (sm:block)') : fail('Video still visible on mobile — scroll stutter risk')

  const mForgot  = await mp.locator('a[href="/forgot-password"]').count()
  const mContact = await mp.locator('a[href^="mailto:"]').count()
  mForgot  ? ok('Forgot password link on mobile') : fail('Forgot password link missing on mobile')
  mContact ? ok('Contact support link on mobile') : fail('Contact support missing on mobile')

  // Horizontal scroll check — sign-in
  const mBodyWidth   = await mp.evaluate(() => document.body.scrollWidth)
  const mViewport    = 375
  mBodyWidth <= mViewport
    ? ok(`No horizontal scroll on sign-in (scrollWidth: ${mBodyWidth}px)`)
    : fail(`Horizontal scroll on sign-in: body is ${mBodyWidth}px wide`)

  // Events list mobile
  hdr('Mobile — Events list')
  await mp.goto(`${BASE}/events`, { waitUntil: 'networkidle' })
  await shot(mp, '10_events_mobile')
  const mEventsWidth = await mp.evaluate(() => document.body.scrollWidth)
  mEventsWidth <= mViewport
    ? ok(`No horizontal scroll on events (scrollWidth: ${mEventsWidth}px)`)
    : fail(`Horizontal scroll on events: ${mEventsWidth}px`)

  // Event detail mobile
  if (firstEventHref && firstEventHref !== '/events/create') {
    hdr('Mobile — Event detail')
    await mp.goto(`${BASE}${firstEventHref}`, { waitUntil: 'networkidle' })
    await shot(mp, '11_event_detail_mobile')
    const mEventWidth = await mp.evaluate(() => document.body.scrollWidth)
    mEventWidth <= mViewport
      ? ok(`No horizontal scroll on event detail (scrollWidth: ${mEventWidth}px)`)
      : fail(`Horizontal scroll on event detail: ${mEventWidth}px`)

    // Gold location line visible on mobile
    const mLocLine = await mp.locator('p.text-xl').first().count()
    mLocLine ? ok('Gold location line visible on mobile') : fail('Gold location line missing on mobile')

    // Table overflow check (rating ranking if finalized)
    const tables = await mp.locator('table').count()
    if (tables > 0) {
      const tWidth = await mp.locator('table').first().evaluate(el => el.scrollWidth)
      const wrapper = await mp.locator('table').first().evaluate(el => el.parentElement?.scrollWidth ?? el.scrollWidth)
      tWidth <= wrapper + 5
        ? ok(`Table fits container (${tWidth}px in ${wrapper}px wrapper)`)
        : warn(`Table may overflow: ${tWidth}px in ${wrapper}px wrapper`)
    }
  }

  // Rankings mobile
  hdr('Mobile — Rankings')
  await mp.goto(`${BASE}/spelers`, { waitUntil: 'networkidle' })
  await shot(mp, '12_rankings_mobile')
  const mRankWidth = await mp.evaluate(() => document.body.scrollWidth)
  mRankWidth <= mViewport
    ? ok(`No horizontal scroll on rankings (scrollWidth: ${mRankWidth}px)`)
    : fail(`Horizontal scroll on rankings: ${mRankWidth}px`)

  // Check sm:hidden columns are hidden on mobile
  const hiddenCols = await mp.locator('th.hidden').count()
  hiddenCols > 0
    ? ok(`${hiddenCols} column(s) correctly hidden on mobile`)
    : warn('No columns hidden on mobile — table may be cramped')

  await mob.close()
  await browser.close()

  // ── Summary ──────────────────────────────────────────────────────────────
  hdr('SUMMARY')
  if (consoleErrors.length === 0) {
    ok('Zero console errors across all pages')
  } else {
    consoleErrors.forEach(e => warn(`Console error: ${e}`))
  }
  console.log(`\n  Screenshots saved to: ${SS}/\n`)
  console.log(`  Pages checked:`)
  console.log(`    / · /registreren · /forgot-password · /events`)
  console.log(`    /events/[id] · /dashboard · /spelers · /update-password`)
  console.log(`    Desktop 1280px + Mobile 375px\n`)
}

run().catch(e => { console.error('\n  FATAL:', e.message); process.exit(1) })
