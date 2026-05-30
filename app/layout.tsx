import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { HcProvider } from '@/lib/hc-context'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const playfair = Playfair_Display({ variable: '--font-playfair', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'paleta',
  description: 'Play under the Spanish sun. Join paleta — book courts, organise matches, and climb the rankings on the Costa Blanca.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${inter.variable} ${playfair.variable} h-full`}>
      <body className="min-h-full flex flex-col text-white antialiased" style={{ background: '#061420' }}>

        {/* ── Fixed video background – visible on every page ── */}
        <video
          autoPlay loop muted playsInline
          className="fixed inset-0 w-full h-full object-cover pointer-events-none"
          style={{ zIndex: -3 }}
        >
          <source src="/videos/Video1_SD.mp4" type="video/mp4" />
        </video>

        {/* Dark base overlay */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'rgba(6,18,32,0.58)', zIndex: -2 }}
        />

        {/* Warm ambient gradient */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(140deg, rgba(175,95,25,0.38) 0%, rgba(155,75,15,0.20) 22%, rgba(20,78,108,0.18) 55%, rgba(6,18,32,0.28) 100%)',
            zIndex: -2,
          }}
        />

        {/* Sun glow – top right */}
        <div
          className="fixed pointer-events-none"
          style={{
            top: '-110px', right: '-90px',
            width: '520px', height: '520px',
            background: 'radial-gradient(circle, rgba(245,178,48,0.46) 0%, rgba(245,140,28,0.20) 34%, transparent 68%)',
            zIndex: -2,
          }}
        />

<HcProvider>
          <Navbar />
          <main className="flex-1 pt-24 hc-zone">{children}</main>
          <footer className="border-t border-white/10 py-6 text-center text-white/25 text-xs tracking-widest uppercase">
            © {new Date().getFullYear()} paleta · Costa Blanca
          </footer>
        </HcProvider>

      </body>
    </html>
  )
}
