import './globals.css'
import { Inter } from 'next/font/google'
import { LanguageProvider } from '@/lib/i18n/language-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "UMLmodeller",
  description: 'Generated with love',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
