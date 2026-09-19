import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Database,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Files,
  Search,
  ShieldCheck,
  Table2,
  LayoutTemplate,
  FileOutput,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { PreviewDoc } from "@/components/site/preview-doc"
import { HomeSearch } from "@/components/templates/home-search"
import { TemplateCard } from "@/components/templates/template-card"
import { getPreviewDoc, type TemplatePreviewDoc } from "@/lib/templates/preview"
import {
  getCategory,
  templates as fallbackTemplates,
  type TemplateDefinition,
} from "@/lib/documents/catalog"
import { orm } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
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

// Випадковий шаблон обирається на кожен запит — сторінку не можна
// пререндерити статично (інакше вибір застигне на етапі білда).
export const dynamic = "force-dynamic"

export default async function Page() {
  // Роль для адмін-доступних елементів (навігація/CTA). Це лише UI —
  // сторінки /admin/* перевіряють доступ на сервері.
  const sessionUser = await getSessionUser()
  const isAdmin = sessionUser?.role === "ADMIN"

  // Прев'ю реального DOCX-шаблону (один випадковий активний, на кожне
  // завантаження сторінки) + живі лічильники для мікро-метрик.
  // Будь-яка помилка (БД недоступна) → фолбеки: null / 0.
  let previewDoc: TemplatePreviewDoc | null = null
  let templatesCount = 0
  let exportsCount = 0
  let dbTemplates: TemplateDefinition[] = []
  const categoryTitleBySlug = new Map<string, string>()
  try {
    const [
      preview,
      templatesAggregate,
      exportsAggregate,
      latestTemplates,
      dbCategories,
    ] = await Promise.all([
      getPreviewDoc(),
      orm.Template.where({ isActive: true }).aggregate((agg) => ({
        count: agg.count(),
      })),
      orm.ExportedFile.aggregate((agg) => ({ count: agg.count() })),
      // Останні додані шаблони (без docxData — легкий запит) для каталогу.
      orm.Template.select(
        "id",
        "categorySlug",
        "title",
        "description",
        "fields",
        "popular",
        "paper",
        "tags",
        "updatedAt"
      )
        .where({ isActive: true })
        .orderBy((t) => t.updatedAt.desc())
        .limit(6)
        .all(),
      // Мапа slug → title для бейджа категорії (на майбутні категорії).
      orm.Category.where({ isActive: true }).select("slug", "title").all(),
    ])
    previewDoc = preview
    templatesCount = templatesAggregate.count
    exportsCount = exportsAggregate.count
    for (const c of dbCategories) categoryTitleBySlug.set(c.slug, c.title)
    dbTemplates = latestTemplates.map((t) => ({
      id: t.id,
      categorySlug: t.categorySlug,
      title: t.title,
      description: t.description,
      fields: t.fields,
      popular: t.popular,
      paper: t.paper === "А4 альбом" ? "А4 альбом" : "А4",
      tags: [...t.tags],
      updatedAt: String(t.updatedAt),
    }))
  } catch (error) {
    console.warn("[home] не вдалося отримати дані для головної", error)
  }
  // Фолбек: статичний каталог, якщо в БД немає активних шаблонів.
  const catalogItems: TemplateDefinition[] =
    dbTemplates.length > 0 ? dbTemplates : fallbackTemplates

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />

      {/* HERO */}
      <section id="hero" className="relative border-b">
        {/* декоративні елементи обрізаємо в межах hero, щоб вони не
            перекривали випадаючий список пошуку */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {/* декоративна сітка */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_80%_60%_at_50%_0%,#000_70%,transparent_110%)] bg-size-[32px_32px] opacity-[0.35]" />
          <div className="absolute inset-x-0 top-0 h-120 bg-linear-to-b from-primary/10 via-primary/4 to-transparent" />
        </div>

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
                <span className="font-medium text-foreground">Word</span> —
                швидко та без помилок.
              </p>
            </div>

            {/* пошук по всьому каталогу (усі категорії) з живими підказками */}
            <HomeSearch />

            {/* мікро-метрики */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border bg-card p-3">
                <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                  ШАБЛОНІВ
                </div>
                <div className="mt-1 text-xl leading-none font-semibold">
                  {templatesCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  з валідацією Zod
                </div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                  ЕКСПОРТ
                </div>
                <div className="mt-1 flex items-center gap-1 text-xl leading-none font-semibold">
                  <FileSpreadsheet className="size-4 text-primary" />{" "}
                  {exportsCount}
                </div>
                <div className="text-xs text-muted-foreground">Word</div>
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
              <CardHeader className="flex-row items-center justify-between border-b">
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
              </CardHeader>

              <CardContent className="bg-white p-0 dark:bg-zinc-900">
                {previewDoc ? (
                  <PreviewDoc item={previewDoc} />
                ) : (
                  /* імітація аркуша А4 (фолбек, якщо немає активних DOCX) */
                  <div className="mx-auto max-w-130 bg-white text-zinc-900 shadow-inner dark:bg-zinc-900 dark:text-zinc-100">
                    <div className="text-[12px] leading-relaxed">
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
                        <span className="rounded bg-amber-100 px-1">
                          15 діб
                        </span>{" "}
                        з виїздом до м. Львів.
                      </p>
                      <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3 text-[11px]">
                        <div>
                          <div className="text-zinc-500">
                            Військовослужбовець
                          </div>
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
                )}
              </CardContent>

              <CardFooter className="justify-between gap-2 bg-muted/30 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Files className="size-3.5" />
                  Автозаповнення з картки персоналії
                </span>
                <span className="font-medium">Готово до друку</span>
              </CardFooter>
            </Card>

            {/* міні-картки під прев'ю */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-6 lg:px-8 lg:py-5">
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
        </div>
      </section>

      {/* TEMPLATES — каталог, останні додані шаблони з БД */}
      <section id="templates" className="border-y">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              Каталог шаблонів
            </h2>
            <div className="flex items-center gap-2">
              <Badge className="rounded-full">
                {templatesCount || catalogItems.length} шаблонів
              </Badge>
              <span className="text-xs text-muted-foreground">
                + категорії додасть адмін
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalogItems.map((item) => (
              <TemplateCard
                key={item.id}
                template={item}
                categoryTitle={
                  categoryTitleBySlug.get(item.categorySlug) ??
                  getCategory(item.categorySlug)?.title ??
                  null
                }
              />
            ))}
          </div>
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
                {isAdmin && (
                  <Link
                    href="/admin/personnel"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "w-full sm:w-auto lg:w-full"
                    )}
                  >
                    Додати особовий склад
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
