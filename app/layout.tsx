import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sistema de Gestión de Jubilaciones - Municipalidad de Córdoba',
  description: 'Sistema interno de gestión de jubilaciones para la Municipalidad de Córdoba',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1e3a8a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="bg-background">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
