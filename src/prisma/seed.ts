import "dotenv/config"
import bcrypt from "bcrypt"
import { db, orm, nowTimestamp } from "./db"
import { categories, templates } from "../../lib/documents/catalog"

async function main() {
  console.log("Seeding categories (foundation for admin CRUD)...")
  for (const c of categories) {
    await orm.Category.upsert({
      create: {
        slug: c.slug,
        title: c.title,
        description: c.description,
        longDescription: c.longDescription,
        icon: c.icon,
        countLabel: c.countLabel,
        isActive: true,
        updatedAt: nowTimestamp(),
      },
      update: {
        title: c.title,
        description: c.description,
        longDescription: c.longDescription,
        icon: c.icon,
        countLabel: c.countLabel,
        isActive: true,
        updatedAt: nowTimestamp(),
      },
      conflictOn: { slug: c.slug },
    })
  }
  console.log(`Seeded ${categories.length} categories`)

  console.log("Seeding templates...")
  // Знайдемо адміна для createdById (якщо є)
  const adminUser: { id: string } | null = await orm.User.select("id").first({ username: "admin" })

  const categoryMap = new Map<string, string>()
  const dbCategories = await orm.Category.select("slug", "id").all()
  for (const c of dbCategories) categoryMap.set(c.slug, c.id)

  for (const t of templates) {
    const categoryId = categoryMap.get(t.categorySlug) ?? null
    await orm.Template.upsert({
      create: {
        id: t.id,
        categoryId,
        categorySlug: t.categorySlug,
        title: t.title,
        fields: t.fields,
        popular: t.popular,
        description: t.description,
        tags: [...t.tags],
        paper: t.paper,
        isActive: true,
        ...(adminUser ? { createdById: adminUser.id } : {}),
        updatedAt: nowTimestamp(),
      },
      update: {
        categoryId,
        categorySlug: t.categorySlug,
        title: t.title,
        fields: t.fields,
        popular: t.popular,
        description: t.description,
        tags: [...t.tags],
        paper: t.paper,
        isActive: true,
        ...(adminUser ? { createdById: adminUser.id } : {}),
        updatedAt: nowTimestamp(),
      },
    })
  }
  console.log(`Seeded ${templates.length} templates in ${categories.length} categories`)

  // Видалити все лишнє — лишити тільки рапорти/відпустку (1 категорія, 1 шаблон)
  const keepCategorySlugs = new Set(categories.map((c) => c.slug)) // зараз тільки raporty
  const keepTemplateIds = new Set(templates.map((t) => t.id)) // зараз тільки raport-vidpustka

  const staleCategories = await orm.Category.where((c) => c.slug.notIn([...keepCategorySlugs])).select("id", "slug").all()
  if (staleCategories.length > 0) {
    console.log(`Cleaning stale categories: ${staleCategories.map((c) => c.slug).join(", ")}`)
    const staleCatIds = staleCategories.map((c) => c.id)
    // видалити пов'язані шаблони/поля/експорти
    const staleTpls = await orm.Template.where((t) => t.categoryId.in(staleCatIds)).select("id").all()
    const staleTplIds = staleTpls.map((t) => t.id)
    if (staleTplIds.length > 0) {
      await orm.TemplateField.where((tf) => tf.templateId.in(staleTplIds)).deleteAll()
      await orm.ExportedFile.where((ef) => ef.templateId.in(staleTplIds)).deleteAll()
      await orm.Template.where((t) => t.id.in(staleTplIds)).deleteAll()
    }
    await orm.Category.where((c) => c.id.in(staleCatIds)).deleteAll()
  }

  const staleTemplates = await orm.Template.where((t) => t.id.notIn([...keepTemplateIds])).select("id").all()
  if (staleTemplates.length > 0) {
    console.log(`Cleaning stale templates: ${staleTemplates.map((t) => t.id).join(", ")}`)
    await orm.TemplateField.where((tf) => tf.templateId.in(staleTemplates.map((t) => t.id))).deleteAll()
    await orm.ExportedFile.where((ef) => ef.templateId.in(staleTemplates.map((t) => t.id))).deleteAll()
    await orm.Template.where((t) => t.id.in(staleTemplates.map((t) => t.id))).deleteAll()
  }
  // Почистити поля для vidryadzhennya якщо лишаємо vidpustka
  await orm.TemplateField.where({ templateId: "raport-vidryadzhennya" }).deleteAll()
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
    await orm.TemplateField.upsert({
      create: {
        templateId: "raport-vidpustka",
        key: f.key,
        label: f.label,
        _type: f.type,
        required: f.required,
        placeholder: p.placeholder ?? null,
        options: (p.options as never) ?? undefined,
        validation: (p.validation as never) ?? undefined,
        sortOrder: f.sortOrder,
        updatedAt: nowTimestamp(),
      },
      update: {
        label: f.label,
        _type: f.type,
        required: f.required,
        placeholder: p.placeholder ?? null,
        options: (p.options as never) ?? undefined,
        validation: (p.validation as never) ?? undefined,
        sortOrder: f.sortOrder,
        updatedAt: nowTimestamp(),
      },
      conflictOn: { templateId: "raport-vidpustka", key: f.key },
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
    const exists = await orm.Personnel.where({ lastName: p.lastName, firstName: p.firstName, unit: p.unit }).first()
    if (!exists) await orm.Personnel.create({ ...p, updatedAt: nowTimestamp() })
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
    const upserted = await orm.User.upsert({
      create: {
        username: u.username,
        password: hash,
        role: u.role,
        isActive: true,
        updatedAt: nowTimestamp(),
      },
      update: {
        password: hash,
        role: u.role,
        isActive: true,
        updatedAt: nowTimestamp(),
      },
      conflictOn: { username: u.username },
    })
    await orm.Profile.upsert({
      create: { userId: upserted.id, ...u.profile, updatedAt: nowTimestamp() },
      update: { ...u.profile, updatedAt: nowTimestamp() },
      conflictOn: { userId: upserted.id },
    })
    // Якщо шаблони вже засіяні без createdBy — оновити (для першого запуску де admin був null)
    if (u.username === "admin") {
      await orm.Template.where((t) => t.createdById.isNull()).updateAll({ createdById: upserted.id, updatedAt: nowTimestamp() })
    }
    console.log(` - ${u.username} (${u.role}) -> profile: ${u.profile.lastName} ${u.profile.firstName}, rank: ${u.profile.rank}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.close()
  })