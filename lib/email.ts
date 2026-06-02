/**
 * Email utility — uses the Resend HTTP API (no SDK dependency).
 * Requires RESEND_API_KEY in environment. If absent, sends are silently
 * skipped so missing config never breaks core signup logic.
 * Set EMAIL_FROM to override the sender address.
 */

const FROM = process.env.EMAIL_FROM ?? 'paleta <noreply@paleta.es>'

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
