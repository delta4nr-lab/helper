import "dotenv/config"
import bcrypt from "bcrypt"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { categories, templates } from "../lib/documents/catalog"
import { normalizeDatabaseUrl } from "../lib/db/connection-string"

const adapter = new PrismaPg({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL!) })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding categories (foundation for admin CRUD)...")
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        title: c.title,
        description: c.description,
        longDescription: c.longDescription,
        icon: c.icon,
        countLabel: c.countLabel,
        isActive: true,
      },
      create: {
        slug: c.slug,
        title: c.title,
        description: c.description,
        longDescription: c.longDescription,
        icon: c.icon,
        countLabel: c.countLabel,
        isActive: true,
      },
    })
  }
  console.log(`Seeded ${categories.length} categories`)

  console.log("Seeding templates...")
  // Знайдемо адміна для createdById (якщо є)
  let adminUser: { id: string } | null = await prisma.user.findUnique({
    where: { username: "admin" },
    select: { id: true },
  })

  const categoryMap = new Map<string, string>()
  const dbCategories = await prisma.category.findMany({ select: { slug: true, id: true } })
  for (const c of dbCategories) categoryMap.set(c.slug, c.id)

  for (const t of templates) {
    const categoryId = categoryMap.get(t.categorySlug) ?? null
    await prisma.template.upsert({
      where: { id: t.id },
      update: {
        categoryId,
        categorySlug: t.categorySlug,
        title: t.title,
        fields: t.fields,
        popular: t.popular,
        description: t.description,
        tags: t.tags,
        paper: t.paper,
        isActive: true,
        ...(adminUser ? { createdById: adminUser.id } : {}),
      },
      create: {
        id: t.id,
        categoryId,
        categorySlug: t.categorySlug,
        title: t.title,
        fields: t.fields,
        popular: t.popular,
        description: t.description,
        tags: t.tags,
        paper: t.paper,
        isActive: true,
        ...(adminUser ? { createdById: adminUser.id } : {}),
      },
    })
  }
  console.log(`Seeded ${templates.length} templates in ${categories.length} categories`)

  // Видалити все лишнє — лишити тільки рапорти/відпустку (1 категорія, 1 шаблон)
  const keepCategorySlugs = new Set(categories.map((c) => c.slug)) // зараз тільки raporty
  const keepTemplateIds = new Set(templates.map((t) => t.id)) // зараз тільки raport-vidpustka

  const staleCategories = await prisma.category.findMany({
    where: { slug: { notIn: [...keepCategorySlugs] } },
    select: { id: true, slug: true },
  })
  if (staleCategories.length > 0) {
    console.log(`Cleaning stale categories: ${staleCategories.map((c) => c.slug).join(", ")}`)
    const staleCatIds = staleCategories.map((c) => c.id)
    // видалити пов'язані шаблони/поля/документи
    const staleTpls = await prisma.template.findMany({ where: { categoryId: { in: staleCatIds } }, select: { id: true } })
    const staleTplIds = staleTpls.map((t) => t.id)
    if (staleTplIds.length > 0) {
      await prisma.templateField.deleteMany({ where: { templateId: { in: staleTplIds } } })
      await prisma.document.deleteMany({ where: { templateId: { in: staleTplIds } } })
      await prisma.template.deleteMany({ where: { id: { in: staleTplIds } } })
    }
    await prisma.document.deleteMany({ where: { categoryId: { in: staleCatIds } } })
    await prisma.category.deleteMany({ where: { id: { in: staleCatIds } } })
  }

  const staleTemplates = await prisma.template.findMany({
    where: { id: { notIn: [...keepTemplateIds] } },
    select: { id: true },
  })
  if (staleTemplates.length > 0) {
    console.log(`Cleaning stale templates: ${staleTemplates.map((t) => t.id).join(", ")}`)
    await prisma.templateField.deleteMany({ where: { templateId: { in: staleTemplates.map((t) => t.id) } } })
    await prisma.document.deleteMany({ where: { templateId: { in: staleTemplates.map((t) => t.id) } } })
    await prisma.template.deleteMany({ where: { id: { in: staleTemplates.map((t) => t.id) } } })
  }
  // Почистити поля для vidryadzhennya якщо лишаємо vidpustka
  await prisma.templateField.deleteMany({ where: { templateId: "raport-vidryadzhennya" } })
  console.log("Cleaned old fields for raport-vidryadzhennya")

  // Пілот: нейтральні поля для raport-vidpustka — єдиний рапорт (можуть перевикористовуватись в nakaz/dopovid)
  console.log("Seeding TemplateField for raport-vidpustka (нейтральні, унікальні key)...")
  const pilotFields = [
    { key: "personnelId", label: "Особовий склад", type: "personnel", required: false, placeholder: "Оберіть зі списку", sortOrder: 0 },
    { key: "documentType", label: "Тип відпустки", type: "select", required: true, options: ["щорічна", "соціальна", "за сімейними обставинами", "навчальна", "для лікування після поранення"], sortOrder: 1 },
    { key: "startDate", label: "Дата початку", type: "date", required: true, sortOrder: 2 },
    { key: "durationDays", label: "Тривалість (діб)", type: "number", required: true, placeholder: "45", sortOrder: 3, validation: { min: 1, max: 90 } },
    { key: "location", label: "Місце проведення", type: "text", required: true, placeholder: "Одеська обл., м. Одеса, вул. Академіка Гамале, 60", sortOrder: 4 },
    { key: "documentNumber", label: "Номер документа-підстави (ВЛК)", type: "text", required: false, placeholder: "2026-0724-1157-2892-7", sortOrder: 5 },
    { key: "documentDate", label: "Дата документа-підстави (ВЛК)", type: "date", required: false, sortOrder: 6 },
    { key: "contactPhone", label: "Контактний телефон", type: "text", required: false, placeholder: "(050) 2289154", sortOrder: 7 },
    { key: "basis", label: "Підстава / примітка", type: "textarea", required: false, placeholder: "Рішення ВЛК, виписка №5263 від 27.07.2026...", sortOrder: 8 },
  ] as const

  for (const f of pilotFields) {
    const p = f as { placeholder?: string; options?: unknown; validation?: unknown }
    await prisma.templateField.upsert({
      where: { templateId_key: { templateId: "raport-vidpustka", key: f.key } },
      update: {
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: p.placeholder ?? null,
        options: (p.options as never) ?? undefined,
        validation: (p.validation as never) ?? undefined,
        sortOrder: f.sortOrder,
      },
      create: {
        templateId: "raport-vidpustka",
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: p.placeholder ?? null,
        options: (p.options as never) ?? undefined,
        validation: (p.validation as never) ?? undefined,
        sortOrder: f.sortOrder,
      },
    })
  }
  console.log(`Seeded ${pilotFields.length} fields for raport-vidpustka`)

  console.log("Seeding personnel demo...")
  const demo = [
    { lastName: "Петренко", firstName: "Іван", middleName: "Васильович", rank: "капітан", position: "командир роти", unit: "А1234", status: "в строю" },
    { lastName: "Ковальчук", firstName: "Олена", middleName: "Миколаївна", rank: "ст. лейтенант", position: "заступник", unit: "А1234", status: "відрядження" },
    { lastName: "Шевченко", firstName: "Андрій", middleName: "Юрійович", rank: "солдат", position: "водій", unit: "А1234/2", status: "в строю" },
    { lastName: "Мельник", firstName: "Тетяна", middleName: "Олександрівна", rank: "мл. сержант", position: "діловод", unit: "Штаб", status: "відпустка" },
    { lastName: "Богатир", firstName: "Руслан", middleName: "Олександрович", rank: "солдат", position: "курсант 1 взводу 4 роти", unit: "А1890", status: "в строю" },
  ]
  for (const p of demo) {
    const exists = await prisma.personnel.findFirst({
      where: { lastName: p.lastName, firstName: p.firstName, unit: p.unit },
    })
    if (!exists) await prisma.personnel.create({ data: p })
  }
  console.log(`Seeded ${demo.length} personnel`)

  console.log("Seeding users (admin creates others, profile = ПІБ + звання, аватар = літера)...")
  const users = [
    {
      username: "admin",
      password: process.env.ADMIN_PASSWORD || "Admin123!",
      role: "ADMIN" as const,
      profile: { lastName: "Адміністратор", firstName: "Системи", middleName: null, rank: "адмін" },
    },
    {
      username: "user",
      password: process.env.USER_PASSWORD || "User123!",
      role: "USER" as const,
      profile: { lastName: "Петренко", firstName: "Іван", middleName: "Васильович", rank: "капітан" },
    },
    {
      username: "kovalchuk",
      password: "Koval123!",
      role: "USER" as const,
      profile: { lastName: "Ковальчук", firstName: "Олена", middleName: "Миколаївна", rank: "ст. лейтенант" },
    },
  ]

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10)
    const upserted = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        password: hash,
        role: u.role,
        isActive: true,
        profile: {
          upsert: {
            create: u.profile,
            update: u.profile,
          },
        },
      },
      create: {
        username: u.username,
        password: hash,
        role: u.role,
        isActive: true,
        profile: { create: u.profile },
      },
      include: { profile: true },
    })
    // Якщо шаблони вже засіяні без createdBy — оновити (для першого запуску де admin був null)
    if (u.username === "admin") {
      await prisma.template.updateMany({
        where: { createdById: null },
        data: { createdById: upserted.id },
      })
    }
    console.log(` - ${u.username} (${u.role}) -> profile: ${u.profile.lastName} ${u.profile.firstName}, rank: ${u.profile.rank}`)
  }

  // Демо документ для профілю — відпустка з нейтральними полями
  const admin = await prisma.user.findUnique({ where: { username: "admin" } })
  const user = await prisma.user.findUnique({ where: { username: "user" } })
  if (admin && user) {
    const cat = await prisma.category.findUnique({ where: { slug: "raporty" } })
    // Знайти Богатиря для прив'язки
    const bogatyr = await prisma.personnel.findFirst({ where: { lastName: "Богатир", firstName: "Руслан" } })
    // Приклад з docx — Богатир ВЛК (якщо ще немає, створити)
    const existingBogatyrDoc = await prisma.document.findFirst({
      where: { title: { contains: "Богатир" } },
    })
    if (!existingBogatyrDoc && bogatyr) {
      await prisma.document.create({
        data: {
          templateId: "raport-vidpustka",
          categoryId: cat?.id ?? null,
          categorySlug: "raporty",
          title: "Рапорт на відпустку ВЛК — Богатир Р.О. (приклад з docx)",
          data: {
            personnelId: bogatyr.id,
            documentType: "для лікування після поранення",
            startDate: "2026-07-28",
            durationDays: 45,
            location: "Одеська обл., м. Одеса, вул. Академіка Гамале, 60",
            documentNumber: "2026-0724-1157-2892-7",
            documentDate: "2026-07-24",
            contactPhone: "(050) 2289154",
            basis: "Рішення ВЛК від 24.07.2026 №2026-0724-1157-2892-7. До рапорту додаю: копію довідки ВЛК від 24.07.2026 №2026-0724-1157-2892-7 та копію виписки із медичної карти стаціонарного хворого від 27.07.2026 №5263. Із забороною вживання алкогольних та наркотичних речовин ознайомлений.",
          },
          status: "чернетка",
          authorId: user.id,
          personnelId: bogatyr.id,
        },
      })
      console.log("Seeded example document: Богатир ВЛК (з docx)")
    }
    const existingVidpustka = await prisma.document.count({ where: { templateId: "raport-vidpustka" } })
    if (existingVidpustka === 0) {
      await prisma.document.create({
        data: {
          templateId: "raport-vidpustka",
          categoryId: cat?.id ?? null,
          categorySlug: "raporty",
          title: "Рапорт на відпустку — Петренко І.В. з 2026-06-01",
          data: {
            personnelId: "",
            documentType: "щорічна",
            startDate: "2026-06-01",
            durationDays: 15,
            location: "м. Львів",
            documentNumber: "2026-0724-1157-2892-7",
            documentDate: "2026-07-24",
            contactPhone: "(050) 1234567",
            basis: "Рішення ВЛК — може перевикористовуватись в nakaz/dopovid",
          },
          status: "чернетка",
          authorId: user.id,
        },
      })
      console.log("Seeded 1 demo document: raport-vidpustka (нейтральні поля)")
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
