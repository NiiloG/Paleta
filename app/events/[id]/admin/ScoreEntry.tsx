'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  generateEventDraw, saveEventScore, finalizeEvent,
  assignMatchPlayers, updateEvent,
  adminRemovePlayer, adminAddPlayer, resetEventDraw,
  updateMatchCourt, updateAllMatchesCourt,
} from '@/app/actions/events'
import { createClient } from '@/lib/supabase/client'
import type { Event, EventSignup, EventMatch, Profiel } from '@/types'
import { eloColor, eloToPlaytomic } from '@/lib/tier'

interface Props {
  event: Event & {
    event_signups: (EventSignup & { profielen: Profiel | null })[]
    event_matches: (EventMatch & {
      a1p: Profiel | null; a2p: Profiel | null; b1p: Profiel | null; b2p: Profiel | null
    })[]
  }
}

type AvailablePlayer = { id: string; naam: string; elo_rating: number; player_number: number | null }

// ── Shared styles ────────────────────────────────────────────────────────
const innerPanel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '14px',
}
const scoreInputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)',
  borderRadius: '8px', color: '#fff', width: '60px', padding: '6px',
  fontSize: '18px', fontWeight: 700, textAlign: 'center', outline: 'none',
}
const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)',
  borderRadius: '8px', color: '#fff', width: '100%', padding: '6px 8px',
  fontSize: '13px', outline: 'none',
}
const fieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)',
  borderRadius: '8px', color: '#fff', width: '100%', padding: '8px 12px',
  fontSize: '13px', outline: 'none',
}
const editLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.16em',
  color: 'rgba(255,255,255,0.35)', marginBottom: '5px',
}
const optStyle: React.CSSProperties = {
  textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)',
}
function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)'
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)'
}
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
// Build a timezone-aware ISO datetime so the DB stores the correct UTC equivalent.
function buildDatetime(isoDate: string, hhmm: string): string {
  const off  = -new Date().getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const h    = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const m    = String(Math.abs(off) % 60).padStart(2, '0')
  return `${isoDate}T${hhmm}:00${sign}${h}:${m}`
}

// Calendar picker showing DD-MM-YYYY regardless of browser locale.
function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const display = value
    ? `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`
    : ''
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 36px 0 12px',
        fontSize: '13px',
        color: value ? '#fff' : 'rgba(255,255,255,0.3)',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        {display || 'DD-MM-YYYY'}
      </span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...fieldStyle, color: 'transparent', colorScheme: 'dark' }}
        onFocus={focusOn}
        onBlur={focusOff}
      />
    </div>
  )
}
function levelPickerLabel(val: number): string {
  if (val >= 6.0) return 'Expert'
  if (val >= 4.0) return 'Advanced'
  if (val >= 2.0) return 'Intermediate'
  return 'Beginner'
}

type PlayerOption = { id: string; label: string }

type MatchForPrint = EventMatch & {
  a1p: Profiel | null; a2p: Profiel | null; b1p: Profiel | null; b2p: Profiel | null
}

// ── Score sheet HTML generator (one A4 page per court) ────────────────────
function buildScoreSheetHtml(
  courts: Array<{ courtNumber: number; round1: MatchForPrint | null }>,
  eventTitle: string,
  eventDatetime: string,
): string {
  const d       = new Date(eventDatetime)
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const subtitle = `${eventTitle} · ${dateStr} · ${timeStr}`

  const paddle = `<svg viewBox="-5 -5 75 90" width="24" height="32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="38" height="50" rx="19" fill="none" stroke="#f5a623" stroke-width="3.5"/><line x1="19" y1="50" x2="19" y2="68" stroke="#f5a623" stroke-width="3.5" stroke-linecap="round"/><circle cx="50" cy="4" r="7" fill="#f5a623"/></svg>`

  // All player-number boxes and score boxes share these exact dimensions.
  const BOX_W = '56px'
  const BOX_H = '36px'

  // All ID and score boxes use the same thick black border to signal "write here".
  const INPUT_BORDER = '2px solid #111'

  function box(content: string): string {
    return `<div style="width:${BOX_W};height:${BOX_H};min-width:${BOX_W};border:${INPUT_BORDER};display:flex;align-items:center;justify-content:center;background:#fff;font-size:16px;font-weight:700;color:#111;flex-shrink:0;">${content}</div>`
  }

  // One player row: [numbox] [name line]  or  [name line] [numbox]
  function playerRow(
    num: number | null | undefined,
    name: string | null | undefined,
    side: 'left' | 'right',
    filled: boolean,
  ): string {
    const numEl  = box(num != null ? String(num) : '')
    const nameEl = filled
      ? `<div style="flex:1;border-bottom:1.5px solid #333;padding-bottom:2px;font-size:11px;color:#111;text-align:${side === 'right' ? 'right' : 'left'};">${name ?? ''}</div>`
      : `<div style="flex:1;">
           <div style="font-size:9px;color:#aaa;margin-bottom:3px;text-align:${side === 'right' ? 'right' : 'left'};">name optional</div>
           <div style="border-bottom:1px solid #ccc;"></div>
         </div>`
    const items = side === 'left' ? `${numEl}${nameEl}` : `${nameEl}${numEl}`
    return `<div style="display:flex;align-items:flex-end;gap:6px;">${items}</div>`
  }

  function roundHtml(num: number, match: MatchForPrint | null): string {
    const filled   = num === 1 && match !== null && match.a1p !== null
    const a1 = filled ? match?.a1p : null
    const a2 = filled ? match?.a2p : null
    const b1 = filled ? match?.b1p : null
    const b2 = filled ? match?.b2p : null

    const outerBorder   = num === 1 ? '1.5px solid #111' : '1px solid #ccc'
    const headerBg      = '#f0f0f0'
    const headerColor   = '#333'
    const preFilledTag  = (filled && num === 1)
      ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.04em;color:#999;">PRE-FILLED — write score only</span>`
      : ''
    const scoreBox = box('')

    return `<div style="border:${outerBorder};border-radius:5px;margin-bottom:5mm;overflow:hidden;">
  <div style="background:${headerBg};padding:6px 10px;display:flex;justify-content:space-between;align-items:center;">
    <span style="color:${headerColor};font-weight:800;font-size:12px;letter-spacing:0.14em;">ROUND ${num}</span>
    ${preFilledTag}
  </div>
  <div style="padding:10px 12px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:7px;">
      <span style="font-size:8px;font-weight:700;letter-spacing:0.1em;color:#888;text-transform:uppercase;">Team 1</span>
      <span style="font-size:8px;font-weight:700;letter-spacing:0.1em;color:#888;text-transform:uppercase;">Team 2</span>
    </div>
    <div style="display:flex;align-items:flex-end;gap:0;margin-bottom:7px;">
      <div style="flex:1;">${playerRow(a1?.player_number, a1?.naam, 'left',  filled)}</div>
      <div style="width:36px;flex-shrink:0;"></div>
      <div style="flex:1;">${playerRow(b1?.player_number, b1?.naam, 'right', filled)}</div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:0;margin-bottom:10px;">
      <div style="flex:1;">${playerRow(a2?.player_number, a2?.naam, 'left',  filled)}</div>
      <div style="width:36px;flex-shrink:0;text-align:center;padding-bottom:4px;font-weight:800;font-size:11px;color:#555;">VS</div>
      <div style="flex:1;">${playerRow(b2?.player_number, b2?.naam, 'right', filled)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:9px;color:#888;font-weight:600;">score</span>
        ${scoreBox}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${scoreBox}
        <span style="font-size:9px;color:#888;font-weight:600;">score</span>
      </div>
    </div>
  </div>
</div>`
  }

  const pages = courts.map(({ courtNumber, round1 }, idx) => `
<div style="width:100%;page-break-after:${idx === courts.length - 1 ? 'avoid' : 'always'};">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:4mm;margin-bottom:0;border-bottom:2.5px solid #111;">
    <div style="display:flex;align-items:center;gap:10px;">
      ${paddle}
      <div style="line-height:1.1;">
        <div style="font-size:20px;font-weight:300;color:#111;letter-spacing:-0.01em;">paleta</div>
        <div style="font-size:9px;font-weight:800;color:#f5a623;letter-spacing:0.14em;margin-top:2px;">PADEL</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:34px;font-weight:900;color:#111;line-height:1;">Court ${courtNumber}</div>
      <div style="font-size:10px;color:#666;margin-top:3px;">${subtitle}</div>
    </div>
  </div>
  <div style="font-size:9px;color:#888;text-align:center;padding:3px 0;margin-bottom:4mm;border-bottom:0.5px solid #e0e0e0;letter-spacing:0.03em;">
    Fill in the score boxes and player ID boxes
  </div>
  ${roundHtml(1, round1)}
  ${roundHtml(2, null)}
  ${roundHtml(3, null)}
</div>`).join('\n')

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Score Sheets — Paleta</title>
<style>
  @page{size:A4 portrait;margin:12mm 14mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;}
  body{width:182mm;}
  @media print{
    body{width:auto;}
    html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  }
</style>
</head><body>${pages}</body></html>`
}

// ── Inline court number editor ────────────────────────────────────────────
function CourtNumberEditor({ matchId, courtNumber, onSaved }: {
  matchId: string; courtNumber: number; onSaved: () => void
}) {
  const [value, setValue]   = useState(courtNumber.toString())
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1 || num === courtNumber) { setValue(courtNumber.toString()); return }
    setSaving(true); setErr(null)
    const result = await updateMatchCourt(matchId, num)
    if (result?.fout) { setErr(result.fout); setValue(courtNumber.toString()) }
    else onSaved()
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Court</span>
      <input
        type="number" min="1" value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.60)' }}
        onBlur={handleBlur}
        disabled={saving}
        style={{
          background: 'transparent', border: '0.5px solid rgba(255,255,255,0.18)',
          borderRadius: '4px', color: 'rgba(255,255,255,0.55)', outline: 'none',
          width: '40px', padding: '1px 5px', fontSize: '11px', fontWeight: 600,
          textAlign: 'center',
        }}
        title="Click to edit court number"
      />
      {saving && <span className="text-[10px] text-white/25">saving…</span>}
      {err    && <span className="text-[10px]" style={{ color: '#f0a070' }}>{err}</span>}
    </div>
  )
}

// ── Court group header editor (updates all rounds for the court at once) ─
function CourtGroupEditor({ eventId, courtNumber, onSaved }: {
  eventId: string; courtNumber: number; onSaved: () => void
}) {
  const [value, setValue]   = useState(courtNumber.toString())
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1 || num === courtNumber) { setValue(courtNumber.toString()); return }
    setSaving(true); setErr(null)
    const result = await updateAllMatchesCourt(eventId, courtNumber, num)
    if (result?.fout) { setErr(result.fout); setValue(courtNumber.toString()) }
    else onSaved()
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-1.5 mb-4">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Court</span>
      <input
        type="number" min="1" value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.60)' }}
        onBlur={handleBlur}
        disabled={saving}
        style={{
          background: 'transparent', border: '0.5px solid rgba(255,255,255,0.18)',
          borderRadius: '4px', color: 'rgba(255,255,255,0.55)', outline: 'none',
          width: '40px', padding: '1px 5px', fontSize: '11px', fontWeight: 600,
          textAlign: 'center',
        }}
        title="Click to edit court number"
      />
      {saving && <span className="text-[10px] text-white/25">saving…</span>}
      {err    && <span className="text-[10px]" style={{ color: '#f0a070' }}>{err}</span>}
    </div>
  )
}

// ── Player assignment card ────────────────────────────────────────────────
function PlayerAssignmentCard({ match, playerOptions, onSaved, showCourtEditor = true }: {
  match: Props['event']['event_matches'][0]; playerOptions: PlayerOption[]; onSaved: () => void; showCourtEditor?: boolean
}) {
  const [bezig, setBezig] = useState(false)
  const [fout, setFout]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFout(null); setBezig(true)
    const result = await assignMatchPlayers(new FormData(e.currentTarget))
    if (result?.fout) setFout(result.fout); else onSaved()
    setBezig(false)
  }

  const PlayerSelect = ({ name, defaultVal }: { name: string; defaultVal: string | null }) => (
    <select name={name} required defaultValue={defaultVal ?? ''} style={selectStyle}
      onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
      onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}>
      <option value="">— select player —</option>
      {playerOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  )

  return (
    <div style={innerPanel}>
      {showCourtEditor
        ? <CourtNumberEditor matchId={match.id} courtNumber={match.court_number} onSaved={onSaved} />
        : <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-3">Round {match.round_number}</p>
      }
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="match_id" value={match.id} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Team A</p>
            <div className="space-y-1.5">
              <PlayerSelect name="player_a1" defaultVal={match.player_a1} />
              <PlayerSelect name="player_a2" defaultVal={match.player_a2} />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Team B</p>
            <div className="space-y-1.5">
              <PlayerSelect name="player_b1" defaultVal={match.player_b1} />
              <PlayerSelect name="player_b2" defaultVal={match.player_b2} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={bezig}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: bezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
            {bezig ? '…' : 'Assign players'}
          </button>
          {fout && <p className="text-xs" style={{ color: '#f0a070' }}>{fout}</p>}
        </div>
      </form>
    </div>
  )
}

// ── Score entry card ──────────────────────────────────────────────────────
function MatchCard({ match, onSaved, showCourtEditor = true, playerOptions = [] }: {
  match: Props['event']['event_matches'][0]; onSaved: () => void; showCourtEditor?: boolean; playerOptions?: PlayerOption[]
}) {
  const [bezig, setBezig]     = useState(false)
  const [fout, setFout]       = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const scored = match.team_a_score !== null && match.team_b_score !== null
  const aWon   = scored && match.team_a_score! > match.team_b_score!
  const bWon   = scored && match.team_b_score! > match.team_a_score!

  const header = showCourtEditor
    ? <CourtNumberEditor matchId={match.id} courtNumber={match.court_number} onSaved={onSaved} />
    : <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-3">Round {match.round_number}</p>

  const PlayerSelect = ({ name, defaultVal }: { name: string; defaultVal: string | null }) => (
    <select name={name} required defaultValue={defaultVal ?? ''} style={selectStyle}
      onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
      onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}>
      <option value="">— select player —</option>
      {playerOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFout(null); setBezig(true)
    const result = await saveEventScore(new FormData(e.currentTarget))
    if (result?.fout) setFout(result.fout); else onSaved()
    setBezig(false)
  }

  async function handleSavePlayers(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFout(null); setBezig(true)
    const result = await assignMatchPlayers(new FormData(e.currentTarget))
    if (result?.fout) setFout(result.fout); else onSaved()
    setBezig(false)
  }

  if (editing) {
    return (
      <div style={innerPanel}>
        {header}
        <form onSubmit={handleSavePlayers}>
          <input type="hidden" name="match_id" value={match.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Team A</p>
              <div className="space-y-1.5">
                <PlayerSelect name="player_a1" defaultVal={match.player_a1} />
                <PlayerSelect name="player_a2" defaultVal={match.player_a2} />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Team B</p>
              <div className="space-y-1.5">
                <PlayerSelect name="player_b1" defaultVal={match.player_b1} />
                <PlayerSelect name="player_b2" defaultVal={match.player_b2} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={bezig}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: bezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
              {bezig ? '…' : 'Save players'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setFout(null) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.50)' }}>
              Cancel
            </button>
            {fout && <p className="text-xs" style={{ color: '#f0a070' }}>{fout}</p>}
          </div>
        </form>
      </div>
    )
  }

  return (
    <div style={innerPanel}>
      {header}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div style={aWon ? { borderLeft: '2px solid #6fcf97', paddingLeft: '8px' } : {}}>
          <p className="text-xs font-medium mb-0.5" style={{ color: aWon ? '#6fcf97' : 'rgba(255,255,255,0.40)' }}>Team A {aWon && '✓'}</p>
          {[match.a1p, match.a2p].map((p, i) => <p key={i} className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{p?.naam ?? '—'}</p>)}
        </div>
        <div className="text-center">
          {scored ? (
            <p className="text-2xl font-bold font-mono">
              <span style={{ color: aWon ? '#6fcf97' : bWon ? '#ef9a9a' : '#fff' }}>{match.team_a_score}</span>
              <span className="text-white/20 mx-1">–</span>
              <span style={{ color: bWon ? '#6fcf97' : aWon ? '#ef9a9a' : '#fff' }}>{match.team_b_score}</span>
            </p>
          ) : <span className="text-white/20 font-bold">vs</span>}
        </div>
        <div className="text-right" style={bWon ? { borderRight: '2px solid #6fcf97', paddingRight: '8px' } : {}}>
          <p className="text-xs font-medium mb-0.5" style={{ color: bWon ? '#6fcf97' : 'rgba(255,255,255,0.40)' }}>{bWon && '✓ '}Team B</p>
          {[match.b1p, match.b2p].map((p, i) => <p key={i} className="text-sm text-right" style={{ color: 'rgba(255,255,255,0.85)' }}>{p?.naam ?? '—'}</p>)}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="match_id" value={match.id} />
        {['team_a_score', 'team_b_score'].map((name, i) => (
          <input key={name} name={name} type="number" min="0" max="99" required
            defaultValue={i === 0 ? (match.team_a_score ?? '') : (match.team_b_score ?? '')}
            style={scoreInputStyle}
            onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
            onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
          />
        )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key="sep" className="text-white/30 font-bold">–</span>, el], [] as React.ReactNode[])}
        <button type="submit" disabled={bezig}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: bezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
          {bezig ? '…' : 'Save'}
        </button>
        {fout && <p className="text-xs" style={{ color: '#f0a070' }}>{fout}</p>}
      </form>
      {playerOptions.length > 0 && (
        <button type="button" onClick={() => setEditing(true)}
          className="mt-2 text-[11px] transition-colors"
          style={{ color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.25)' }}>
          Edit players
        </button>
      )}
    </div>
  )
}

// ── Edit event form ───────────────────────────────────────────────────────
function EventEditForm({ event, onSaved }: { event: Props['event']; onSaved: () => void }) {
  const [bezig, setBezig]       = useState(false)
  const [fout, setFout]         = useState<string | null>(null)
  const [minLevel, setMinLevel] = useState<string>(event.min_level?.toString() ?? '')
  const [maxLevel, setMaxLevel] = useState<string>(event.max_level?.toString() ?? '')

  const [isoDate, setIsoDate]         = useState(() => toLocalDatetimeInput(event.datetime).split('T')[0])
  const [editTime, setEditTime]       = useState(() => toLocalDatetimeInput(event.datetime).split('T')[1])
  const [editEndTime, setEditEndTime] = useState(() => event.end_time?.slice(0, 5) ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFout(null); setBezig(true)
    const formData = new FormData(e.currentTarget)
    formData.set('datetime', buildDatetime(isoDate, editTime))
    const result = await updateEvent(formData)
    if (result?.fout) setFout(result.fout); else onSaved()
    setBezig(false)
  }

  return (
    <div style={innerPanel}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-4">Edit event</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="event_id" value={event.id} />
        <div>
          <label style={editLabelStyle}>Title</label>
          <input name="title" type="text" required defaultValue={event.title} style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={editLabelStyle}>Date</label>
            <DatePickerField value={isoDate} onChange={setIsoDate} />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label style={editLabelStyle}>Start time</label>
              <input type="time" required value={editTime} onChange={e => setEditTime(e.target.value)}
                style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={editLabelStyle}>End time <span style={optStyle}>(opt.)</span></label>
              <input name="end_time" type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)}
                style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
        </div>
        <div>
          <label style={editLabelStyle}>Location</label>
          <input name="location" type="text" required defaultValue={event.location} style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={editLabelStyle}>Courts</label>
            <input name="court_count" type="number" required min="1" max="10" defaultValue={event.court_count} style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
            <p className="text-[10px] text-white/25 mt-1">Updates capacity & promotions</p>
          </div>
          <div>
            <label style={editLabelStyle}>Court nos. <span style={optStyle}>(opt.)</span></label>
            <input name="court_numbers" type="text" placeholder="e.g. 3, 5" defaultValue={event.court_numbers?.join(', ') ?? ''} style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>
        </div>
        <div>
          <label style={editLabelStyle}>Match type</label>
          <select name="match_type" defaultValue={event.match_type ?? 'Mixed'} style={fieldStyle} onFocus={focusOn} onBlur={focusOff}>
            <option value="Mixed">Mixed</option>
            <option value="Men only">Men only</option>
            <option value="Women only">Women only</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={editLabelStyle}>Min level <span style={optStyle}>(opt.)</span></label>
            <input name="min_level" type="number" min="0" max="7" step="0.5" value={minLevel} onChange={e => setMinLevel(e.target.value)} placeholder="e.g. 2.5" style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
            {minLevel && <p className="text-[10px] mt-1" style={{ color: '#f5a623' }}>{levelPickerLabel(parseFloat(minLevel))}</p>}
          </div>
          <div>
            <label style={editLabelStyle}>Max level <span style={optStyle}>(opt.)</span></label>
            <input name="max_level" type="number" min="0" max="7" step="0.5" value={maxLevel} onChange={e => setMaxLevel(e.target.value)} placeholder="e.g. 5.5" style={fieldStyle} onFocus={focusOn} onBlur={focusOff} />
            {maxLevel && <p className="text-[10px] mt-1" style={{ color: '#f5a623' }}>{levelPickerLabel(parseFloat(maxLevel))}</p>}
          </div>
        </div>
        {fout && <p className="text-xs" style={{ color: '#f0a070' }}>{fout}</p>}
        <button type="submit" disabled={bezig}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: bezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
          {bezig ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function ScoreEntry({ event: initialEvent }: Props) {
  const router                            = useRouter()
  const event                             = initialEvent
  const [drawBezig, setDrawBezig]         = useState(false)
  const [drawFout, setDrawFout]           = useState<string | null>(null)
  const [finalBezig, setFinalBezig]       = useState(false)
  const [finalResult, setFinalResult]     = useState<{ fout?: string } | null>(null)
  // Player management
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [available, setAvailable]         = useState<AvailablePlayer[]>([])
  const [loadingAvail, setLoadingAvail]   = useState(false)
  const [selectedId, setSelectedId]       = useState('')
  const [addBezig, setAddBezig]           = useState(false)
  const [addFout, setAddFout]             = useState<string | null>(null)
  const [removingId, setRemovingId]       = useState<string | null>(null)

  const maxPlayers   = event.court_count * 4
  const confirmed    = event.event_signups.filter(s => s.status === 'confirmed')
  const waitlisted   = event.event_signups.filter(s => s.status === 'waitlisted')
  const signupClosed = Date.now() >= new Date(event.datetime).getTime() - 2 * 60 * 60 * 1000
  const readyForDraw = signupClosed && confirmed.length >= 4 && !event.is_finalized

  const courts: Record<number, typeof event.event_matches> = {}
  event.event_matches.forEach(m => {
    if (!courts[m.court_number]) courts[m.court_number] = []
    courts[m.court_number].push(m)
  })
  const courtNumbers = Object.keys(courts).map(Number).sort((a, b) => a - b)

  const allScored = event.event_matches.length > 0 &&
    event.event_matches.every(m => m.team_a_score !== null && m.team_b_score !== null)

  const playerOptions: PlayerOption[] = confirmed.map(s => ({
    id: s.player_id,
    label: s.profielen?.player_number != null
      ? `#${s.profielen.player_number} ${s.profielen.naam}`
      : (s.profielen?.naam ?? '—'),
  })).sort((a, b) => a.label.localeCompare(b.label))

  async function handleGenerateDraw() {
    setDrawBezig(true); setDrawFout(null)
    const fd = new FormData()
    fd.set('event_id', event.id); fd.set('round_number', '1')
    const result = await generateEventDraw(fd)
    if (result?.fout) setDrawFout(result.fout)
    else window.location.reload()
    setDrawBezig(false)
  }

  async function handleRegenerateDraw() {
    if (!confirm('Delete all current rounds and regenerate from the current player list?')) return
    setDrawBezig(true); setDrawFout(null)
    const r1 = await resetEventDraw(event.id)
    if (r1?.fout) { setDrawFout(r1.fout); setDrawBezig(false); return }
    const fd = new FormData()
    fd.set('event_id', event.id); fd.set('round_number', '1')
    const r2 = await generateEventDraw(fd)
    if (r2?.fout) setDrawFout(r2.fout)
    else window.location.reload()
    setDrawBezig(false)
  }

  async function handleFinalize() {
    if (!confirm('Finalize event and apply ELO changes? This cannot be undone.')) return
    setFinalBezig(true); setFinalResult(null)
    const result = await finalizeEvent(event.id)
    setFinalResult(result ?? {})
    if (!result?.fout) window.location.reload()
    setFinalBezig(false)
  }

  async function handleRemovePlayer(playerId: string) {
    setRemovingId(playerId)
    const result = await adminRemovePlayer(event.id, playerId)
    if (result?.fout) alert(result.fout)
    else window.location.reload()
    setRemovingId(null)
  }

  async function handleOpenAddPlayer() {
    setShowAddPlayer(true); setLoadingAvail(true); setAddFout(null)
    const supabase = createClient()
    const signedIds = new Set(event.event_signups.map(s => s.player_id))
    const { data } = await supabase.from('profielen').select('id, naam, elo_rating, player_number').order('naam')
    setAvailable((data ?? []).filter((p: AvailablePlayer) => !signedIds.has(p.id)))
    setLoadingAvail(false)
  }

  async function handleAddPlayer() {
    if (!selectedId) return
    setAddBezig(true); setAddFout(null)
    const result = await adminAddPlayer(event.id, selectedId)
    if (result?.fout) setAddFout(result.fout)
    else window.location.reload()
    setAddBezig(false)
  }

  function handleCancelAdd() {
    setShowAddPlayer(false); setSelectedId(''); setAddFout(null)
  }

  function handlePrintScoreSheets() {
    const round1 = event.event_matches.filter(m => m.round_number === 1)
    const courtNums = [...new Set(event.event_matches.map(m => m.court_number))].sort((a, b) => a - b)
    const courts = courtNums.map(cn => ({
      courtNumber: cn,
      round1: (round1.find(m => m.court_number === cn) ?? null) as MatchForPrint | null,
    }))
    const html = buildScoreSheetHtml(courts, event.title, event.datetime)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (win) setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(8,20,38,0.50)', border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '14px', backdropFilter: 'blur(12px)',
  }

  return (
    <div className="space-y-5">

      {/* Edit event — always visible */}
      <div style={cardStyle} className="p-5">
        <EventEditForm
          key={`${event.datetime}|${event.end_time ?? ''}|${event.title}`}
          event={event}
          onSaved={() => router.refresh()}
        />
      </div>

      {/* Players */}
      <div style={cardStyle} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Players ({confirmed.length}/{maxPlayers})
          </p>
          {signupClosed && !event.is_finalized ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(42,135,168,0.14)', border: '0.5px solid rgba(42,135,168,0.30)', color: '#6dd0e8' }}>
              Sign-up closed
            </span>
          ) : !signupClosed && confirmed.length === maxPlayers && !event.is_finalized ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(76,175,80,0.14)', border: '0.5px solid rgba(76,175,80,0.32)', color: '#6fcf97' }}>
              Full
            </span>
          ) : null}
        </div>

        {/* Confirmed */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-3">
          {confirmed.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {s.profielen?.player_number != null && (
                <span className="text-[10px] font-mono w-5 text-center rounded flex-shrink-0"
                  style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>
                  {s.profielen.player_number}
                </span>
              )}
              <span className="text-sm text-white/80 truncate flex-1">{s.profielen?.naam ?? '—'}</span>
              {s.profielen?.elo_rating != null && (
                <span className="text-xs font-mono" style={{ color: eloColor(s.profielen.elo_rating), opacity: 0.8 }}>
                  {eloToPlaytomic(s.profielen.elo_rating)}
                </span>
              )}
              {signupClosed && !event.is_finalized && (
                <button
                  onClick={() => handleRemovePlayer(s.player_id)}
                  disabled={removingId === s.player_id}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  style={{ cursor: removingId === s.player_id ? 'not-allowed' : 'pointer', fontSize: '14px', lineHeight: 1 }}
                  title="Remove player"
                >
                  {removingId === s.player_id ? '…' : '×'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Waitlist */}
        {waitlisted.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1.5">Waitlist</p>
            {waitlisted.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-white/25 w-4 flex-shrink-0">{i + 1}.</span>
                <span className="text-sm text-white/40 flex-1">{s.profielen?.naam ?? '—'}</span>
                {s.profielen?.elo_rating != null && (
                  <span className="text-xs font-mono" style={{ color: eloColor(s.profielen.elo_rating), opacity: 0.55 }}>
                    {eloToPlaytomic(s.profielen.elo_rating)}
                  </span>
                )}
                {signupClosed && !event.is_finalized && (
                  <button
                    onClick={() => handleRemovePlayer(s.player_id)}
                    disabled={removingId === s.player_id}
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    style={{ cursor: removingId === s.player_id ? 'not-allowed' : 'pointer', fontSize: '14px', lineHeight: 1 }}
                    title="Remove player"
                  >
                    {removingId === s.player_id ? '…' : '×'}
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {/* Add player (signup closed only) */}
        {signupClosed && !event.is_finalized && (
          <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
            {!showAddPlayer ? (
              <button onClick={handleOpenAddPlayer}
                className="text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: 'rgba(245,166,35,0.75)' }}>
                + Add player
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-white/30">Add player</p>
                {loadingAvail ? (
                  <p className="text-xs text-white/30">Loading…</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedId}
                      onChange={e => setSelectedId(e.target.value)}
                      style={{ ...selectStyle, flex: 1 }}
                      onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
                      onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
                    >
                      <option value="">— select player —</option>
                      {available.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.player_number != null ? `#${p.player_number} ` : ''}{p.naam} ({eloToPlaytomic(p.elo_rating)})
                        </option>
                      ))}
                    </select>
                    <button onClick={handleAddPlayer} disabled={!selectedId || addBezig}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                      style={{
                        background: !selectedId || addBezig ? 'rgba(245,166,35,0.3)' : '#f5a623',
                        color: '#0a2a3d', cursor: !selectedId || addBezig ? 'not-allowed' : 'pointer',
                      }}>
                      {addBezig ? '…' : 'Add'}
                    </button>
                    <button onClick={handleCancelAdd}
                      className="text-xs text-white/35 hover:text-white/70 transition-colors flex-shrink-0">
                      Cancel
                    </button>
                  </div>
                )}
                {addFout && <p className="text-xs" style={{ color: '#f0a070' }}>{addFout}</p>}
              </div>
            )}
          </div>
        )}

        {/* Info text */}
        {!signupClosed && !event.is_finalized && (
          <p className="text-xs text-white/35 mt-2">
            Sign-up closes 2 hours before the event.
            {confirmed.length < maxPlayers && ` Waiting for ${maxPlayers - confirmed.length} more player${maxPlayers - confirmed.length !== 1 ? 's' : ''}.`}
          </p>
        )}
      </div>

      {/* Generate draw — first time, no rounds yet */}
      {readyForDraw && courtNumbers.length === 0 && (
        <div style={cardStyle} className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Generate draw</p>
          <p className="text-xs text-white/35 mb-3">
            Round 1 will be generated by snake draw. Empty courts for rounds 2 and 3 will be created for manual assignment.
          </p>
          {drawFout && <p className="text-xs mb-3" style={{ color: '#f0a070' }}>{drawFout}</p>}
          <button onClick={handleGenerateDraw} disabled={drawBezig}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: drawBezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: drawBezig ? 'not-allowed' : 'pointer' }}>
            {drawBezig ? 'Generating…' : 'Generate Round 1'}
          </button>
        </div>
      )}

      {/* Regenerate draw — after draw exists */}
      {readyForDraw && courtNumbers.length > 0 && (
        <div style={cardStyle} className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Regenerate draw</p>
          <p className="text-xs text-white/35 mb-3">
            Deletes all current rounds and creates a fresh draw from the current player list and court count. Use this after adding, removing, or swapping players.
          </p>
          {drawFout && <p className="text-xs mb-2" style={{ color: '#f0a070' }}>{drawFout}</p>}
          <button onClick={handleRegenerateDraw} disabled={drawBezig}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.70)', cursor: drawBezig ? 'not-allowed' : 'pointer',
            }}>
            {drawBezig ? 'Regenerating…' : 'Regenerate draw'}
          </button>
        </div>
      )}

      {/* Print score sheets */}
      {courtNumbers.length > 0 && (
        <div style={cardStyle} className="px-5 py-3.5 flex items-center justify-between gap-4">
          <p className="text-xs text-white/40">Print a physical A4 score sheet for each court — round 1 players pre-filled.</p>
          <button
            onClick={handlePrintScoreSheets}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.70)' }}
          >
            Print score sheets
          </button>
        </div>
      )}

      {/* Courts */}
      {courtNumbers.map(court => (
        <div key={court} style={cardStyle} className="p-5">
          <CourtGroupEditor eventId={event.id} courtNumber={court} onSaved={() => window.location.reload()} />
          <div className="space-y-3">
            {courts[court].sort((a, b) => a.round_number - b.round_number).map(m =>
              m.player_a1 === null ? (
                <PlayerAssignmentCard key={m.id} match={m} playerOptions={playerOptions} onSaved={() => window.location.reload()} showCourtEditor={false} />
              ) : (
                <MatchCard key={m.id} match={m} onSaved={() => window.location.reload()} showCourtEditor={false} playerOptions={playerOptions} />
              )
            )}
          </div>
        </div>
      ))}

      {/* Finalize */}
      {!event.is_finalized && allScored && courtNumbers.length > 0 && (
        <div style={cardStyle} className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">Finalize event</p>
          <p className="text-xs text-white/40 mb-4">
            All matches are scored. Finalizing will apply ELO changes to all players and lock the event.
          </p>
          {finalResult?.fout && <p className="text-xs mb-3" style={{ color: '#f0a070' }}>{finalResult.fout}</p>}
          <button onClick={handleFinalize} disabled={finalBezig}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: finalBezig ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.85)', color: '#fff', cursor: finalBezig ? 'not-allowed' : 'pointer' }}>
            {finalBezig ? 'Finalizing…' : 'Finalize & apply ELO'}
          </button>
        </div>
      )}

      {event.is_finalized && (
        <div className="p-4 rounded-xl text-sm text-center"
          style={{ background: 'rgba(76,175,80,0.10)', border: '0.5px solid rgba(76,175,80,0.25)', color: '#6fcf97' }}>
          Event finalized. ELO applied.
        </div>
      )}

      <div className="text-right">
        <Link href={`/events/${event.id}`} className="text-xs text-white/40 hover:text-white/70 transition-colors">
          ← Player view
        </Link>
      </div>
    </div>
  )
}
