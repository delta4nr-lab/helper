import Link from "next/link"
import { Shield, FileText } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">КАНЦЕЛЯРІЯ</span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Помічник для військового діловодства. Створюйте документи зі структурованих форм,
              перевикористовуйте дані особового складу та експортуйте в Excel, PDF і Word.
            </p>
            <p className="text-xs text-muted-foreground">
              Інтерфейс та документи — українською. Дані зберігаються локально або на вашому сервері.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Документи</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#templates" className="hover:text-foreground">Рапорт</Link></li>
              <li><Link href="#templates" className="hover:text-foreground">Наказ</Link></li>
              <li><Link href="#templates" className="hover:text-foreground">Довідка</Link></li>
              <li><Link href="#templates" className="hover:text-foreground">Заява</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Можливості</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Шаблони та валідація</li>
              <li>Попередній перегляд</li>
              <li>Експорт Excel / PDF / Word</li>
              <li>Пошук і фільтри</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Безпека</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><FileText className="mt-0.5 size-3.5 shrink-0" /> Дані — лише на сервері</li>
              <li>Валідація на сервері</li>
              <li>Ролі та доступи</li>
              <li>Журнал дій</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Канцелярія. Для службового користування.</span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" /> Система працює
          </span>
        </div>
      </div>
    </footer>
  )
}
