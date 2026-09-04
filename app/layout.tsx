import type { Metadata } from "next"
import { Geist_Mono, Roboto } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const roboto = Roboto({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  display: "swap",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Канцелярія — помічник для військового діловодства",
    template: "%s | Канцелярія",
  },
  description:
    "Сучасний помічник для канцелярських робіт: створення рапортів, наказів та довідок з шаблонів, робота з особовим складом, валідація, попередній перегляд та експорт у Excel, PDF і Word.",
  keywords: [
    "рапорт",
    "військовий документ",
    "канцелярія",
    "наказ",
    "довідка",
    "діловодство",
    "шаблони документів",
    "експорт Excel",
    "docx",
    "pdf",
  ],
  authors: [{ name: "Канцелярія" }],
  openGraph: {
    type: "website",
    locale: "uk_UA",
    title: "Канцелярія — помічник для військового діловодства",
    description:
      "Створюйте документи з форм і шаблонів, перевикористовуйте дані особового складу, експортуйте в Excel / PDF / Word.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="uk"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", roboto.variable)}
    >
      <body>
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
