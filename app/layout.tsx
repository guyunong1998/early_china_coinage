import type { Metadata } from 'next'
import { Playfair_Display, Geist, Geist_Mono, Spectral } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
})

// Archival theme typeface — an editorial serif with an old-document feel,
// used for both headings and body text. See globals.css "TYPOGRAPHY" section
// to swap this out for something else (Geist/Playfair are still loaded above
// and ready to go — just repoint the --font-sans / --font-serif variables).
const spectral = Spectral({
  variable: '--font-spectral',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Early Chinese Coin Finds Database',
  description:
    'A searchable database of pre-Qin to early Han coin discoveries across China.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${spectral.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LanguageProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </LanguageProvider>
      </body>
    </html>
  )
}
