import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Info · paleta' }

const faqs: { q: string; a: string }[] = [
  {
    q: 'What is Americano format?',
    a: 'Americano is a round-robin padel format where players rotate partners every round. You play with and against everyone, and points are tracked individually — making it competitive for all skill levels.',
  },
  {
    q: 'How does the rating system work?',
    a: 'paleta uses an ELO-based rating system. After each event your rating goes up or down based on results relative to your opponents\' ratings. The bigger the upset, the bigger the change. Your displayed rating (1.00–7.00) maps to standard Playtomic levels.',
  },
  {
    q: 'What do the level ranges mean?',
    a: 'Beginner (1.00–2.99) · Intermediate (3.00–3.99) · Advanced (4.00–5.49) · Expert (5.50–7.00). When you register, choose the level that best matches your current game — you can always move up or down through play.',
  },
  {
    q: 'How do I sign up for an event?',
    a: 'Open the Events page, tap an upcoming event, and hit Sign up. You need an account. If the event is full you join the waitlist and get automatically promoted when a spot opens or enough players cancel to form a new court.',
  },
  {
    q: 'What is the waitlist and how does it work?',
    a: 'Courts need exactly 4 players each. If the confirmed count is not yet a multiple of 4 the last players are waitlisted. The moment a 4th player signs up (filling a court) all four are promoted to confirmed together.',
  },
  {
    q: 'When does sign-up close?',
    a: 'Sign-up closes automatically 2 hours before the event starts. After that, the organiser generates the draw and prepares the courts.',
  },
  {
    q: 'How is the draw generated?',
    a: 'Round 1 uses a snake-draw algorithm that distributes players across courts by rating, so each court gets a balanced mix. Rounds 2 and 3 are assigned manually by the organiser to create varied matchups throughout the event.',
  },
  {
    q: 'Can I cancel after signing up?',
    a: 'Yes — open the event and tap Cancel sign-up. If you were confirmed, the remaining players are automatically reshuffled: the first multiple of 4 in the queue get confirmed and the rest return to the waitlist.',
  },
  {
    q: 'Where do events take place?',
    a: 'Events are organised at padel venues in and around Javea on the Costa Blanca. The specific location is listed on each event card.',
  },
  {
    q: 'How do I contact the organisers?',
    a: 'Reach out through the club\'s social channels or speak to any paleta admin in person at an event. Admin accounts are marked in the rankings.',
  },
]

const cardStyle = {
  background: 'rgba(8,20,38,0.50)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '14px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}

export default function InfoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>
          paleta · Javea
        </p>
        <h1 className="font-serif text-4xl font-bold text-white">Info & FAQ</h1>
        <p className="text-white/45 mt-2 text-sm">Everything you need to know about playing with paleta.</p>
      </div>

      <div className="space-y-3">
        {faqs.map(({ q, a }, i) => (
          <div key={i} style={cardStyle} className="px-6 py-5">
            <p className="text-white font-semibold text-sm mb-1.5">{q}</p>
            <p className="text-white/55 text-sm leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
