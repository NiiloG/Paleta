import type { Metadata } from 'next'
import InfoClient from './InfoClient'

export const metadata: Metadata = { title: 'Info · paleta' }

export default function InfoPage() {
  return <InfoClient />
}
