import Link from "next/link"
import { Shield, FileText } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>
            © {new Date().getFullYear()} Канцелярія. Для службового
            користування.
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" /> Система
            працює
          </span>
        </div>
      </div>
    </footer>
  )
}
