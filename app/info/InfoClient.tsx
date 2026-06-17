'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

type Tab = 'faq' | 'contact'

const faqs: { q: string; a: ReactNode; warning?: boolean }[] = [
  {
    q: 'What is Kings of the Court?',
    a: <>During the Kings of the Court event, we will play <strong className="text-white/90">3 rounds of 30 minutes</strong> on various numbered courts.</>,
  },
  {
    q: 'How does it work?',
    a: (
      <span className="space-y-2 flex flex-col">
        <span><strong className="text-white/80">Round 1:</strong> You start on a court that matches your playing level. You will receive this court assignment two hours in advance via email.</span>
        <span><strong className="text-white/80">Rotations:</strong> When the 30-minute round ends, play stops. One player per court is responsible for writing down the ID number/names and scores on the clipboard. Clipboards will be on each court.</span>
        <span>👑 <strong className="text-white/80">Won?</strong> You move up one court. &nbsp; 😅 <strong className="text-white/80">Lost?</strong> You move down one court.</span>
        <span><strong className="text-white/80">Exceptions:</strong> If you are on the top court and you win, you stay there. If you are on the bottom court and you lose, you also stay where you are.</span>
        <span><strong className="text-white/80">New round, new partner!</strong> After every match, the current teams will split up. On your new (or retained) court, you will play the next round with and against different partners. Only the first round is scheduled in advance; the other two rounds are determined purely by your match results.</span>
      </span>
    ),
  },
  {
    q: 'How does the rating system work?',
    a: 'paleta uses an ELO-based rating system. After each event your rating goes up or down based on results relative to your opponents\' ratings. The bigger the upset, the bigger the change. Your displayed rating (0.00–7.00) maps to standard levels.',
  },
  {
    q: 'What do the level ranges mean?',
    a: 'Beginner 0–1.99 · Intermediate 2–3.99 · Advanced 4–5.99 · Expert 6–7. When you register, choose the level that best matches your current game — you will always move up or down through play.',
  },
  {
    q: 'How do I sign up for an event?',
    a: 'Open the Events page, tap an upcoming event, and hit Sign up. You need an account. If the event is full you join the waitlist and get automatically promoted when a spot opens or enough players confirm to form a new court.',
  },
  {
    q: 'What is the waitlist and how does it work?',
    a: 'Courts need exactly 4 players each. If the confirmed count is not yet a multiple of 4 the last players are waitlisted. The moment a 4th player signs up (filling a court) all four are promoted to confirmed together.',
  },
  {
    q: 'When does sign-up close?',
    a: 'Registration closes a set number of hours before the event — the exact deadline depends on the venue and is shown on the event page. Once closed, the organiser will generate the first round based on the ELO rating system.',
  },
  {
    q: 'How does scoring work during the event?',
    a: 'For rounds 2 and 3, one player on each court is responsible for filling in the final scores on the clipboards hanging by the courts.',
  },
  {
    q: 'Can I cancel after signing up?',
    a: 'Yes, if the signup is still open.',
  },
  {
    q: 'What happens if I cancel after sign-up closes?',
    warning: true,
    a: (
      <span className="space-y-2 flex flex-col">
        <span>Because sign-ups are closed, cancelling now will leave your assigned court empty and cost three other players their spot. Please only cancel in a genuine emergency.</span>
        <span>Cancelling after the deadline will:</span>
        <span className="flex flex-col gap-1 pl-3 border-l-2" style={{ borderColor: 'rgba(220,38,38,0.40)' }}>
          <span>· Immediately remove you from the event.</span>
          <span>· Move up to 3 confirmed players back to the waitlist.</span>
          <span>· Notify the event organiser of your late cancellation.</span>
          <span>· <strong>Hold you responsible for <u>the full court fee</u>.</strong></span>
        </span>
        <span style={{ color: 'rgba(255,255,255,0.40)' }}>If you have found a replacement player, please contact the organiser immediately — there may be a possibility to fulfil your place.</span>
      </span>
    ),
  },
  {
    q: 'Where do events take place?',
    a: 'Events are organised at padel venues in and around Javea on the Costa Blanca. The specific location is listed on each event card.',
  },
  {
    q: 'How do I contact the organisers?',
    a: 'The organisers\' contact details are available on the event details page.',
  },
]

const contacts = [
  {
    role: 'Event Admin',
    name: 'Colet Groenewegen',
    email: 'coletgroenewegen@gmail.com',
    phone: null as string | null,
  },
  {
    role: 'Tech Support',
    name: 'Niels Groenewegen',
    email: 'ngreenways@protonmail.com',
    phone: null,
  },
]

const cardStyle = {
  background: 'rgba(8,20,38,0.50)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '14px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}

const warningCardStyle = {
  background: 'rgba(220,38,38,0.12)',
  border: '0.5px solid rgba(220,38,38,0.28)',
  borderRadius: '14px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}

export default function InfoClient() {
  const [tab, setTab] = useState<Tab>('faq')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>
          paleta · Javea
        </p>
        <h1 className="font-serif text-4xl font-bold text-white">Info & FAQ</h1>
        <p className="text-white/45 mt-2 text-sm">Everything you need to know about playing with paleta.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
        {([['faq', 'FAQ'], ['contact', 'Contact']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === id
              ? { background: 'rgba(245,166,35,0.18)', border: '0.5px solid rgba(245,166,35,0.35)', color: '#f5a623' }
              : { color: 'rgba(255,255,255,0.45)', border: '0.5px solid transparent', cursor: 'pointer' }
            }>
            {label}
          </button>
        ))}
      </div>

      {/* FAQ */}
      {tab === 'faq' && (
        <div className="space-y-3">
          {faqs.map(({ q, a, warning }, i) => (
            <div key={i} style={warning ? warningCardStyle : cardStyle}
              className={`px-6 py-5${warning ? ' warning-card' : ''}`}>
              <p className="text-white font-semibold text-lg mb-1.5">{q}</p>
              <div className="text-white/55 text-sm leading-relaxed">{a}</div>
            </div>
          ))}
        </div>
      )}

      {/* Contact */}
      {tab === 'contact' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {contacts.map(c => (
            <div key={c.email} style={cardStyle} className="px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(245,166,35,0.70)' }}>{c.role}</p>
              <p className="text-white font-semibold text-base mb-3">{c.name}</p>
              <div className="space-y-1.5">
                <a href={`mailto:${c.email}`}
                  className="flex items-center gap-2 text-sm transition-opacity hover:opacity-75"
                  style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {c.email}
                </a>
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 text-sm transition-opacity hover:opacity-75"
                    style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {c.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
