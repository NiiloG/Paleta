import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import WelcomePopup from '@/components/WelcomePopup'
import { HcProvider } from '@/lib/hc-context'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const playfair = Playfair_Display({ variable: '--font-playfair', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'paleta',
  description: 'Play under the Spanish sun. Join paleta — book courts, organise matches, and climb the rankings on the Costa Blanca.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '192x192', type: 'image/png' },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${inter.variable} ${playfair.variable} h-full`}>
      <body className="min-h-full flex flex-col text-white antialiased" style={{ background: '#061420' }}>

        {/* ── Blurred placeholder background – replaces video until restored ── */}
        <div className="fixed inset-0 pointer-events-none" style={{
          zIndex: -3,
          background: [
            'radial-gradient(ellipse 80% 60% at 20% 30%, #0d3a5c 0%, transparent 70%)',
            'radial-gradient(ellipse 60% 80% at 75% 60%, #0a4a3a 0%, transparent 65%)',
            'radial-gradient(ellipse 90% 50% at 50% 100%, #0a2233 0%, transparent 60%)',
            'linear-gradient(160deg, #061420 0%, #0a2a3d 45%, #061420 100%)',
          ].join(', '),
          filter: 'blur(40px)',
          transform: 'scale(1.05)',
        }} />

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
          <main className="flex-1 pt-16 lg:pt-24 hc-zone">{children}</main>
          <footer className="border-t border-white/10 py-6 text-center text-white/25 text-xs tracking-widest uppercase">
            © {new Date().getFullYear()} paleta
            <span className="ml-3" style={{ color: 'rgba(245,166,35,0.30)', letterSpacing: '0.10em' }}>beta v5.000</span>
            <span className="mx-2" style={{ color: 'rgba(255,255,255,0.10)' }}>·</span>
            <Link href="/info" className="hover:text-white/50 transition-colors">Built by Niels Groenewegen</Link>
          </footer>
          <WelcomePopup />
        </HcProvider>

      </body>
    </html>
  )
}
