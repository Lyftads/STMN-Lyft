import './globals.css'

export const metadata = {
  title: 'STMN Fitness — LTV:CAC Dashboard',
  description: 'Dashboard automatica LTV, CAC e retention',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
