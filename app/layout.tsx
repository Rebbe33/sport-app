'use client'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Plus, Clock, TrendingUp } from 'lucide-react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  const navItems = [
    { href: '/', icon: CalendarDays, label: 'Semaine' },
    { href: '/seance', icon: Plus, label: 'Séance' },
    { href: '/historique', icon: Clock, label: 'Journal' },
    { href: '/progres', icon: TrendingUp, label: 'Progrès' },
  ]

  return (
    <html lang="fr">
      <head>
        <title>Mon Sport</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F5F2ED" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <main>{children}</main>
        <nav className="nav-bottom">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-btn ${path === href || (href === '/seance' && path.startsWith('/seance')) ? 'active' : ''}`}
            >
              <Icon size={22} strokeWidth={path === href ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </body>
    </html>
  )
}
