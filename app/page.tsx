import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Database,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Files,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Table2,
  LayoutTemplate,
  FileOutput,
  ChevronRight,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

// ——————————————————————————————————————————————
// Дані для секцій (структуровані, легко розширювати)
// ——————————————————————————————————————————————
const features = [
  {
    icon: LayoutTemplate,
    title: "Готові шаблони",
    desc: "Оберіть документ — рапорт, наказ чи довідку — і заповніть кілька полів. Форматування та структура підставляться автоматично.",
  },
  {
    icon: Database,
    title: "Особовий склад в один клік",
    desc: "Додайте дані бійця один раз. Далі ПІБ, звання, посада та підрозділ підтягуються в будь-який документ автоматично.",
  },
  {
    icon: ShieldCheck,
    title: "Перевірка без помилок",
    desc: "Система підсвітить незаповнені поля та невірні дати й підкаже, що виправити — ще до друку. Жодних повернень через дрібниці.",
  },
  {
    icon: Eye,
    title: "Попередній перегляд як на папері",
    desc: "Бачите точну копію майбутнього документа ще до збереження — з таблицями, підписами та датами. Знаєте, що саме піде на друк.",
  },
  {
    icon: FileOutput,
    title: "Завантаження в Excel, PDF, Word",
    desc: "Завантажте готовий файл одним кліком у потрібному форматі. Всі таблиці, підписи та форматування збережуться як треба.",
  },
  {
    icon: Search,
    title: "Швидкий пошук",
    desc: "Знайдіть будь-який документ або людину за секунди — за прізвищем, званням чи типом документа. Зручні фільтри та сортування.",
  },
]

const templates = [
  {
    title: "Рапорт на відпустку",
    fields: 6,
    popular: true,
    desc: "Щорічна, соціальна, за сімейними обставинами — єдиний рапорт у фундаменті",
  },
]

const personnelPreview = [
  {
    name: "Петренко І. В.",
    rank: "капітан",
    pos: "командир роти",
    unit: "А1234",
    status: "в строю",
  },
  {
    name: "Ковальчук О. М.",
    rank: "ст. лейтенант",
    pos: "заступник",
    unit: "А1234",
    status: "відрядження",
  },
  {
    name: "Шевченко А. Ю.",
    rank: "солдат",
    pos: "водій",
    unit: "А1234/2",
    status: "в строю",
  },
  {
    name: "Мельник Т. О.",
    rank: "мл. сержант",
    pos: "діловод",
    unit: "Штаб",
    status: "відпустка",
  },
]

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />

      {/* HERO */}
      <section id="hero" className="relative overflow-hidden border-b">
        {/* декоративна сітка */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_80%_60%_at_50%_0%,#000_70%,transparent_110%)] bg-size-[32px_32px] opacity-[0.35]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-120 bg-linear-to-b from-primary/10 via-primary/4 to-transparent" />

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:py-14">
          {/* left */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="gap-1.5 rounded-full px-2.5 py-1 text-xs"
              >
                <span className="size-2 rounded-full bg-emerald-500" />
                Для стройової та кадрової служб
              </Badge>
              <Badge variant="outline" className="rounded-full text-xs">
                <Sparkles className="size-3" />
                Нові шаблони щотижня
              </Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-[42px]">
                Помічник для
                <span className="text-primary"> канцелярії</span>
                <br />
                та військового
                <br />
                діловодства
              </h1>
              <p className="max-w-[56ch] text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[15px]">
                Створюйте документи з форм і шаблонів, перевикористовуйте дані
                особового складу, валідуйте, переглядайте перед друком та
                експортуйте в{" "}
                <span className="font-medium text-foreground">
                  Excel, PDF і Word
                </span>{" "}
                — швидко та без помилок.
              </p>
            </div>

            {/* пошук-бар як у адмінці */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl border bg-card p-1.5 shadow-sm">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Пошук: рапорт на відпустку, наказ, довідка..."
                    className="h-9 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                  />
                </div>
                <Link
                  href="#templates"
                  className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
                >
                  Знайти шаблон
                  <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Популярне:</span>
                <Link
                  href="#templates"
                  className="rounded-full border bg-muted px-2.5 py-1 hover:bg-muted/80"
                >
                  Рапорт
                </Link>
                <Link
                  href="#templates"
                  className="rounded-full border bg-muted px-2.5 py-1 hover:bg-muted/80"
                >
                  Наказ
                </Link>
                <Link
                  href="#templates"
                  className="rounded-full border bg-muted px-2.5 py-1 hover:bg-muted/80"
                >
                  Довідка
                </Link>
                <span className="hidden sm:inline">
                  • українською • формат А4
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="#templates"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                <FileText className="size-4" />
                Створити документ
              </Link>
              <Link
                href="#how"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" })
                )}
              >
                Як це працює
                <ChevronRight className="size-4" />
              </Link>
            </div>

            {/* мікро-метрики */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border bg-card p-3">
                <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                  ШАБЛОНІВ
                </div>
                <div className="mt-1 text-xl leading-none font-semibold">1</div>
                <div className="text-xs text-muted-foreground">
                  з валідацією Zod
                </div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                  ЕКСПОРТ
                </div>
                <div className="mt-1 flex items-center gap-1 text-xl leading-none font-semibold">
                  <FileSpreadsheet className="size-4 text-primary" /> 3
                </div>
                <div className="text-xs text-muted-foreground">
                  Excel · PDF · Word
                </div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                  ЧАС
                </div>
                <div className="mt-1 flex items-center gap-1 text-xl leading-none font-semibold">
                  <Clock3 className="size-4 text-primary" /> ~2 хв
                </div>
                <div className="text-xs text-muted-foreground">
                  від форми до файлу
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BadgeCheck className="size-4 text-emerald-600" />
              Працює офлайн на вашому сервері. Без передачі даних третім
              сторонам.
            </div>
          </div>

          {/* right: preview paper */}
          <div className="relative lg:pl-4">
            <div className="absolute -top-6 -right-6 hidden size-28 rounded-full bg-primary/10 blur-3xl lg:block" />
            <Card className="overflow-hidden rounded-2xl border shadow-lg">
              <CardHeader className="flex-row items-center justify-between gap-2 border-b bg-muted/40 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <FileCheck className="size-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm leading-none">
                      Попередній перегляд
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Рапорт · А4 · ДСТУ
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[11px]"
                  >
                    <Eye className="size-3" />
                    Live
                  </Badge>
                  <Button size="icon-xs" variant="outline" aria-label="Експорт">
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="bg-white p-0 dark:bg-zinc-900">
                {/* імітація аркуша А4 */}
                <div className="mx-auto max-w-130 bg-white p-6 text-zinc-900 shadow-inner dark:bg-zinc-900 dark:text-zinc-100">
                  <div className="space-y-4 text-[12px] leading-relaxed">
                    <div className="text-right text-[11px] leading-none text-zinc-500">
                      Командиру військової частини А1234
                      <br />
                      полковнику ІВАНЕНКУ І.І.
                    </div>
                    <div className="text-center text-[11px] tracking-widest text-zinc-500">
                      РАПОРТ
                    </div>
                    <p>
                      Прошу Вашого клопотання перед вищим командуванням щодо
                      надання мені щорічної основної відпустки з{" "}
                      <span className="rounded bg-amber-100 px-1">
                        12.05.2026
                      </span>{" "}
                      тривалістю{" "}
                      <span className="rounded bg-amber-100 px-1">15 діб</span>{" "}
                      з виїздом до м. Львів.
                    </p>
                    <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3 text-[11px]">
                      <div>
                        <div className="text-zinc-500">Військовослужбовець</div>
                        <div className="font-medium">
                          Петренко І.В., капітан
                        </div>
                        <div className="text-zinc-500">командир роти</div>
                      </div>
                      <div className="text-right">
                        <div className="text-zinc-500">Дата</div>
                        <div className="font-medium">28.08.2026</div>
                        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          <BadgeCheck className="size-3" /> валідно
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3 text-[11px]">
                      <span className="text-zinc-500">
                        Підпис _________________
                      </span>
                      <span className="rounded border bg-zinc-50 px-2 py-1 dark:bg-zinc-800">
                        Експорт: XLSX · PDF · DOCX
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-between gap-2 bg-muted/30 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Files className="size-3.5" />
                  Автозаповнення з картки персоналії
                </span>
                <span className="font-medium">Готово до друку</span>
              </CardFooter>
            </Card>

            {/* плаваючі міні-картки */}
            <div className="pointer-events-none absolute -bottom-3 -left-3 hidden gap-2 lg:flex">
              <div className="rounded-xl border bg-card px-3 py-2 shadow-md">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Table2 className="size-3.5 text-primary" /> Таблиці збережено
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Колонки, підписи, дати
                </div>
              </div>
              <div className="rounded-xl border bg-card px-3 py-2 shadow-md">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <ShieldCheck className="size-3.5 text-emerald-600" />{" "}
                  Валідація Zod
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Двічі: клієнт + сервер
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="rounded-full">
              Можливості
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Все для швидкого діловодства
            </h2>
            <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
              Заповніть просту форму — отримайте готовий документ для друку.
              Без ручного набору в Word, без помилок у даних та без зайвої
              паперової тяганини.
            </p>
          </div>
          <Link
            href="#templates"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Переглянути шаблони
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="gap-3 py-4">
              <CardHeader className="gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl border bg-muted">
                  <f.icon className="size-4" />
                </span>
                <CardTitle className="text-[15px]">{f.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {f.desc}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* TEMPLATES — хаб, зараз 1 категорія рапорти */}
      <section id="templates" className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              Каталог шаблонів
            </h2>
            <div className="flex items-center gap-2">
              <Badge className="rounded-full">1 базовий</Badge>
              <span className="text-xs text-muted-foreground">
                + категорії додасть адмін
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card
                key={t.title}
                className="group relative overflow-hidden py-0"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
                <CardHeader className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-4" />
                      </span>
                      <div>
                        <CardTitle className="text-sm">{t.title}</CardTitle>
                        <div className="text-xs text-muted-foreground">
                          {t.fields} полів
                        </div>
                      </div>
                    </div>
                    {t.popular && (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[11px]"
                      >
                        Популярний
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="pt-1 text-sm leading-relaxed">
                    {t.desc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 pb-3">
                  <Badge variant="outline" className="text-[11px]">
                    Zod · валідація
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    А4
                  </Badge>
                </CardContent>
                <CardFooter className="gap-2">
                  <Link
                    href="#hero"
                    className={cn(buttonVariants({ size: "sm" }), "flex-1")}
                  >
                    Створити
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Eye className="size-3.5" />
                    Перегляд
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONNEL + EXPORT */}
      <section
        id="personnel"
        className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-12"
      >
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-4 border-b bg-card py-4">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Users className="size-4" />
              </span>
              <div>
                <CardTitle className="text-sm">Особовий склад</CardTitle>
                <CardDescription className="text-xs">
                  Пошук, фільтри, пагінація — серверні
                </CardDescription>
              </div>
            </div>
            <Link
              href="#personnel"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Відкрити
              <ChevronRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Пошук за ПІБ, званням, посадою..."
                  className="h-8 pl-7 text-sm"
                />
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex">
                4 показано
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">ПІБ</th>
                    <th className="px-3 py-2 text-left font-medium">Звання</th>
                    <th className="px-3 py-2 text-left font-medium">Посада</th>
                    <th className="px-3 py-2 text-left font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {personnelPreview.map((p) => (
                    <tr key={p.name} className="hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <div className="leading-none font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.unit}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {p.rank}
                      </td>
                      <td className="px-3 py-2.5">{p.pos}</td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={
                            p.status === "в строю" ? "default" : "secondary"
                          }
                          className="rounded-full text-[11px]"
                        >
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          <CardFooter className="justify-between text-xs text-muted-foreground">
            <span>
              Окремі поля: прізвище / імʼя / по батькові — форматування в одному
              місці (lib/names).
            </span>
            <span className="hidden sm:inline">
              Дати — як Date, формат лише для відображення.
            </span>
          </CardFooter>
        </Card>

        <div id="export" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Download className="size-4 text-primary" />
                Експорт — незалежно від UI
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Document Data → Exporter → File. Зберігає структуру,
                форматування, таблиці та підписи.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-emerald-50 p-3 text-center dark:bg-emerald-950/30">
                <FileSpreadsheet className="mx-auto size-6 text-emerald-600" />
                <div className="mt-1 text-xs font-semibold">Excel</div>
                <div className="text-[11px] text-muted-foreground">exceljs</div>
              </div>
              <div className="rounded-xl border bg-red-50 p-3 text-center dark:bg-red-950/30">
                <FileText className="mx-auto size-6 text-red-600" />
                <div className="mt-1 text-xs font-semibold">PDF</div>
                <div className="text-[11px] text-muted-foreground">
                  server-side
                </div>
              </div>
              <div className="rounded-xl border bg-blue-50 p-3 text-center dark:bg-blue-950/30">
                <FileText className="mx-auto size-6 text-blue-600" />
                <div className="mt-1 text-xs font-semibold">Word</div>
                <div className="text-[11px] text-muted-foreground">docx</div>
              </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-xs text-muted-foreground">
              <Separator />
              <span>
                Імена файлів зрозумілі: Рапорт_Петренко_2026-05-12.docx
              </span>
            </CardFooter>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Для слабких ПК та серверів
              </CardTitle>
              <CardDescription className="text-sm">
                Server Components, серверна фільтрація та пагінація, кеш
                довідників, lazy для важких бібліотек.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">Server Components</Badge>
              <Badge variant="secondary">Prisma + PostgreSQL</Badge>
              <Badge variant="secondary">Zod</Badge>
              <Badge variant="secondary">React Hook Form</Badge>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section id="how" className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-primary/10 via-primary/5 to-transparent">
            <CardContent className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold tracking-tight">
                  Готові спростити канцелярію?
                </h3>
                <p className="max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
                  Почніть з рапорту — побачите, як автозаповнення, валідація та
                  експорт економлять години на тиждень. Інтерфейс — компактний,
                  інформативний, без зайвих декорацій.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    Безпека — серверна перевірка кожної дії
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
                    <Clock3 className="size-3.5" />
                    Розгортання за хвилини
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                <Link
                  href="#templates"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "w-full sm:w-auto lg:w-full"
                  )}
                >
                  Створити перший документ
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="#personnel"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full sm:w-auto lg:w-full"
                  )}
                >
                  Додати особовий склад
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
