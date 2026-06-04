/**
 * Email utility — uses the Resend HTTP API (no SDK dependency).
 * Requires RESEND_API_KEY in environment. If absent, sends are silently
 * skipped so missing config never breaks core signup logic.
 * Set EMAIL_FROM to override the sender address.
 *
 * ── Supabase signup confirmation template ────────────────────────────────
 * The function `buildSignupConfirmationTemplate` below returns the HTML to
 * paste into Supabase Dashboard → Authentication → Email Templates →
 * "Confirm signup" → Message (HTML editor).
 * Supabase replaces {{ .ConfirmationURL }} with the real link automatically.
 */

const FROM = process.env.EMAIL_FROM ?? 'paleta <noreply@paleta.es>'

interface LateCancellationParams {
  to: string
  adminName: string
  cancellerName: string
  eventTitle: string
  eventDatetime: string
  eventLocation: string
}

export async function sendLateCancellationEmail(p: LateCancellationParams) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping late cancel email to', p.to)
    return
  }

  const d    = new Date(p.eventDatetime)
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [p.to],
        subject: `⚠️ Late cancellation: ${p.eventTitle}`,
        html: buildLateCancellationHtml({ ...p, date, time }),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[email] Resend error', res.status, JSON.stringify(body), '→', p.to)
    } else {
      console.log('[email] Sent late cancellation notice to', p.to)
    }
  } catch (err) {
    console.error('[email] fetch failed:', err)
  }
}

function buildLateCancellationHtml(p: LateCancellationParams & { date: string; time: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#061420;font-family:system-ui,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="480" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden">

        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle" style="padding-right:10px">
                <img src="${LOGO_DATA_URI}" width="32" height="43" alt="paleta" style="display:block">
              </td>
              <td valign="middle">
                <div style="font-size:20px;font-weight:300;color:#ffffff;letter-spacing:-0.01em;line-height:1.1">paleta</div>
                <div style="margin-top:3px;font-size:9px;letter-spacing:0.16em;line-height:1">
                  <span style="color:#f5a623;font-weight:700">PADEL</span><span style="color:rgba(255,255,255,0.38)"> &middot; JAVEA</span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:28px 32px 0">
          <div style="display:inline-block;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:6px 14px;margin-bottom:20px">
            <span style="color:#f87171;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Late cancellation</span>
          </div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff">A player cancelled after sign-up closed</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.70)">
            Hi ${p.adminName},<br><br>
            <strong style="color:#f87171">${p.cancellerName}</strong> cancelled their sign-up for the following event <em>after the sign-up deadline</em>. Court assignments and player numbers may need to be reviewed.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 24px">
          <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:16px 20px">
            <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#fff">${p.eventTitle}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.60)">${p.date} &nbsp;&middot;&nbsp; ${p.time} &nbsp;&middot;&nbsp; ${p.eventLocation}</p>
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 32px">
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,.55)">
            Affected players on the waitlist have been automatically notified. Please check the admin panel and update the draw if necessary.
          </p>
          <p style="margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,.10);font-size:11px;color:rgba(255,255,255,.30)">
            This notification was sent to all paleta admins.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

interface PromotionParams {
  to: string
  name: string
  eventTitle: string
  eventDatetime: string
  eventLocation: string
}

export async function sendDemotedToWaitlistEmail(p: PromotionParams) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', p.to)
    return
  }

  const d    = new Date(p.eventDatetime)
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [p.to],
        subject: `Waitlisted for ${p.eventTitle} — a player dropped out`,
        html: buildDemotionHtml({ ...p, date, time }),
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[email] Resend error', res.status, JSON.stringify(body), '→', p.to)
    } else {
      console.log('[email] Sent waitlist demotion to', p.to)
    }
  } catch (err) {
    console.error('[email] fetch failed:', err)
  }
}

export async function sendWaitlistPromotionEmail(p: PromotionParams) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', p.to)
    return
  }

  const d    = new Date(p.eventDatetime)
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [p.to],
        subject: `You're confirmed for ${p.eventTitle} 🎾`,
        html: buildHtml({ ...p, date, time }),
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[email] Resend error', res.status, JSON.stringify(body), '→', p.to)
    } else {
      console.log('[email] Sent waitlist promotion to', p.to)
    }
  } catch (err) {
    console.error('[email] fetch failed:', err)
  }
}

function buildDemotionHtml(p: PromotionParams & { date: string; time: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#061420;font-family:system-ui,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="480" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden">

        <!-- Logo header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle" style="padding-right:10px">
                <img src="${LOGO_DATA_URI}" width="32" height="43" alt="paleta" style="display:block">
              </td>
              <td valign="middle">
                <div style="font-size:20px;font-weight:300;color:#ffffff;letter-spacing:-0.01em;line-height:1.1">paleta</div>
                <div style="margin-top:3px;font-size:9px;letter-spacing:0.16em;line-height:1">
                  <span style="color:#f5a623;font-weight:700">PADEL</span><span style="color:rgba(255,255,255,0.38)"> &middot; JAVEA</span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px 0">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff">You've been waitlisted</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.70)">
            Hi ${p.name},<br><br>
            A player has dropped out and there are no longer enough people to fill a full court.
            You've been moved to the <strong style="color:#f5a623">waitlist</strong> for:
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 24px">
          <div style="background:rgba(245,166,35,.10);border:1px solid rgba(245,166,35,.25);border-radius:10px;padding:16px 20px">
            <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#fff">${p.eventTitle}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.60)">${p.date} &nbsp;&middot;&nbsp; ${p.time} &nbsp;&middot;&nbsp; ${p.eventLocation}</p>
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 32px">
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,.55)">
            You'll be automatically confirmed again as soon as enough players sign up to fill another court. No action needed from you.
          </p>
          <p style="margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,.10);font-size:11px;color:rgba(255,255,255,.30)">
            You can turn off event emails in your paleta profile settings.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const LOGO_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSItNSAtNSA3NSA5MCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjQzIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIzOCIgaGVpZ2h0PSI1MCIgcng9IjE5IiBmaWxsPSJub25lIiBzdHJva2U9IiNmNWE2MjMiIHN0cm9rZS13aWR0aD0iMy41Ii8+PGxpbmUgeDE9IjE5IiB5MT0iNTAiIHgyPSIxOSIgeTI9IjY4IiBzdHJva2U9IiNmNWE2MjMiIHN0cm9rZS13aWR0aD0iMy41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjQiIHI9IjciIGZpbGw9IiNmNWE2MjMiLz48L3N2Zz4='

function buildHtml(p: PromotionParams & { date: string; time: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#061420;font-family:system-ui,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="480" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden">

        <!-- Logo header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle" style="padding-right:10px">
                <img src="${LOGO_DATA_URI}" width="32" height="43" alt="paleta" style="display:block">
              </td>
              <td valign="middle">
                <div style="font-size:20px;font-weight:300;color:#ffffff;letter-spacing:-0.01em;line-height:1.1">paleta</div>
                <div style="margin-top:3px;font-size:9px;letter-spacing:0.16em;line-height:1">
                  <span style="color:#f5a623;font-weight:700">PADEL</span><span style="color:rgba(255,255,255,0.38)"> &middot; JAVEA</span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px 0">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff">You're confirmed! 🎾</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.70)">
            Hi ${p.name},<br><br>
            A spot opened up and you've been moved from the waitlist to
            <strong style="color:#6fcf97">confirmed</strong>:
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 24px">
          <div style="background:rgba(245,166,35,.10);border:1px solid rgba(245,166,35,.25);border-radius:10px;padding:16px 20px">
            <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#fff">${p.eventTitle}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.60)">${p.date} &nbsp;&middot;&nbsp; ${p.time} &nbsp;&middot;&nbsp; ${p.eventLocation}</p>
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 32px">
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,.55)">See you on the court. 🌞</p>
          <p style="margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,.10);font-size:11px;color:rgba(255,255,255,.30)">
            You can turn off event emails in your paleta profile settings.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Draw notification email ───────────────────────────────────────────────

interface DrawNotificationParams {
  to: string
  name: string
  courtNumber: number
  partnerName: string
  opp1Name: string
  opp2Name: string
  eventTitle: string
  eventDatetime: string
  eventLocation: string
  eventMapsUrl?: string | null
}

export async function sendDrawNotificationEmail(p: DrawNotificationParams) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping draw notification to', p.to)
    return
  }
  const d    = new Date(p.eventDatetime)
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [p.to],
        subject: `Court ${p.courtNumber} · ${p.eventLocation} — ${p.eventTitle}`,
        html: buildDrawNotificationHtml({ ...p, date, time }),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[email] Resend error', res.status, JSON.stringify(body), '→', p.to)
    } else {
      console.log('[email] Sent draw notification to', p.to)
    }
  } catch (err) {
    console.error('[email] fetch failed:', err)
  }
}

function buildDrawNotificationHtml(p: DrawNotificationParams & { date: string; time: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#061420;font-family:system-ui,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="480" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden">

        <!-- Logo header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <table cellpadding="0" cellspacing="0"><tr>
            <td valign="middle" style="padding-right:10px">
              <img src="${LOGO_DATA_URI}" width="32" height="43" alt="paleta" style="display:block">
            </td>
            <td valign="middle">
              <div style="font-size:20px;font-weight:300;color:#ffffff;letter-spacing:-0.01em;line-height:1.1">paleta</div>
              <div style="margin-top:3px;font-size:9px;letter-spacing:0.16em;line-height:1">
                <span style="color:#f5a623;font-weight:700">PADEL</span><span style="color:rgba(255,255,255,0.38)"> &middot; JAVEA</span>
              </div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Court hero -->
        <tr><td style="padding:32px 32px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(245,166,35,0.09);border:1px solid rgba(245,166,35,0.28);border-radius:14px">
            <tr><td style="padding:30px 20px;text-align:center">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.22em;color:rgba(245,166,35,0.55);text-transform:uppercase;margin-bottom:10px">Your court</div>
              <div style="font-size:96px;font-weight:900;color:#f5a623;line-height:1;letter-spacing:-0.03em">${p.courtNumber}</div>
              <div style="margin-top:14px;font-size:12px;color:rgba(255,255,255,0.40)">${p.eventMapsUrl ? `<a href="${p.eventMapsUrl}" style="color:rgba(245,166,35,0.65);text-decoration:underline;">${p.eventLocation}</a>` : p.eventLocation} &nbsp;&middot;&nbsp; ${p.date} &nbsp;&middot;&nbsp; ${p.time}</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:24px 32px 0">
          <p style="margin:0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.70)">
            Hi ${p.name},<br><br>
            The draw for <strong style="color:#fff">${p.eventTitle}</strong> is set. Here's your Round 1 match:
          </p>
        </td></tr>

        <!-- Round 1 match card -->
        <tr><td style="padding:20px 32px 0">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.30);text-transform:uppercase;margin-bottom:10px">Round 1 draw</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;overflow:hidden">
            <!-- Your team -->
            <tr><td style="padding:18px 20px 16px;border-bottom:1px solid rgba(255,255,255,0.07)">
              <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;color:rgba(111,207,151,0.75);text-transform:uppercase;margin-bottom:12px">Your team</div>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td width="20" valign="middle" style="padding-right:8px;padding-bottom:8px">
                    <div style="width:8px;height:8px;background:#6fcf97;border-radius:50%">&nbsp;</div>
                  </td>
                  <td style="padding-bottom:8px">
                    <span style="font-size:17px;font-weight:700;color:#fff">${p.name}</span>
                    <span style="font-size:11px;font-weight:600;color:rgba(245,166,35,0.70);margin-left:6px">(you)</span>
                  </td>
                </tr>
                <tr>
                  <td width="20" valign="middle" style="padding-right:8px">
                    <div style="width:8px;height:8px;background:#6fcf97;border-radius:50%">&nbsp;</div>
                  </td>
                  <td>
                    <span style="font-size:17px;font-weight:700;color:#fff">${p.partnerName}</span>
                  </td>
                </tr>
              </table>
            </td></tr>
            <!-- VS -->
            <tr><td style="padding:9px 20px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.07);text-align:center">
              <span style="font-size:11px;font-weight:900;letter-spacing:0.28em;color:rgba(255,255,255,0.22)">VS</span>
            </td></tr>
            <!-- Opponents -->
            <tr><td style="padding:16px 20px 18px">
              <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;color:rgba(239,154,154,0.70);text-transform:uppercase;margin-bottom:12px">Opponents</div>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td width="20" valign="middle" style="padding-right:8px;padding-bottom:8px">
                    <div style="width:8px;height:8px;background:#ef9a9a;border-radius:50%">&nbsp;</div>
                  </td>
                  <td style="padding-bottom:8px">
                    <span style="font-size:17px;font-weight:600;color:rgba(255,255,255,0.82)">${p.opp1Name}</span>
                  </td>
                </tr>
                <tr>
                  <td width="20" valign="middle" style="padding-right:8px">
                    <div style="width:8px;height:8px;background:#ef9a9a;border-radius:50%">&nbsp;</div>
                  </td>
                  <td>
                    <span style="font-size:17px;font-weight:600;color:rgba(255,255,255,0.82)">${p.opp2Name}</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 32px 32px">
          <p style="margin:0 0 6px;font-size:14px;color:rgba(255,255,255,0.55)">See you on court ${p.courtNumber}. Good luck! 🎾</p>
          <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid rgba(255,255,255,0.10);font-size:11px;color:rgba(255,255,255,0.30)">
            You can turn off event emails in your paleta profile settings.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Paste the return value of this function into:
 * Supabase Dashboard → Authentication → Email Templates → Confirm signup → Message (HTML)
 *
 * {{ .ConfirmationURL }} is automatically replaced by Supabase with the real link.
 */
export function buildSignupConfirmationTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#061420;font-family:system-ui,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="480" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden">

        <!-- Logo header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle" style="padding-right:10px">
                <img src="${LOGO_DATA_URI}" width="32" height="43" alt="paleta" style="display:block">
              </td>
              <td valign="middle">
                <div style="font-size:20px;font-weight:300;color:#ffffff;letter-spacing:-0.01em;line-height:1.1">paleta</div>
                <div style="margin-top:3px;font-size:9px;letter-spacing:0.16em;line-height:1">
                  <span style="color:#f5a623;font-weight:700">PADEL</span><span style="color:rgba(255,255,255,0.38)"> &middot; JAVEA</span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px 0">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff">Confirm your account</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.70)">
            Welcome to paleta &mdash; click the button below to verify your email address and activate your account.
          </p>
        </td></tr>

        <!-- CTA button -->
        <tr><td style="padding:0 32px 28px">
          <a href="{{ .ConfirmationURL }}"
            style="display:inline-block;background:#f5a623;color:#0a2a3d;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.01em;">
            Confirm email
          </a>
        </td></tr>

        <!-- Fallback link + footer -->
        <tr><td style="padding:0 32px 32px">
          <p style="margin:0 0 12px;font-size:13px;color:rgba(255,255,255,.45);line-height:1.6">
            Or copy and paste this link into your browser:<br>
            <span style="color:rgba(245,166,35,.70);word-break:break-all;font-size:12px;">{{ .ConfirmationURL }}</span>
          </p>
          <p style="margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,.10);font-size:11px;color:rgba(255,255,255,.30)">
            If you didn&apos;t create a paleta account you can safely ignore this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
