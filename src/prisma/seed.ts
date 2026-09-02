import "dotenv/config"
import bcrypt from "bcrypt"
import { db, orm, nowTimestamp } from "./db"

async function main() {
  console.log("Seeding categories (foundation for admin CRUD)...")
  const seedCategories = [
    {
      slug: "raporty",
      title: "Рапорти",
      description: "Відпустки, відрядження, заохочення, переміщення",
      longDescription: "Найчастіші документи військовослужбовця. Автозаповнення з картки персоналії, перевірка дат і строків.",
      icon: "raporty",
      countLabel: "шаблонів",
    },
  ]
  for (const c of seedCategories) {
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
  console.log(`Seeded ${seedCategories.length} categories`)

  console.log("Seeding template (raport-vidpustka)...")
  const adminUser: { id: string } | null = await orm.User.select("id").first({ username: "admin" })
  const categoryMap = new Map<string, string>()
  const dbCategories = await orm.Category.select("slug", "id").all()
  for (const c of dbCategories) categoryMap.set(c.slug, c.id)

  await orm.Template.upsert({
    create: {
      id: "raport-vidpustka",
      categoryId: categoryMap.get("raporty") ?? null,
      categorySlug: "raporty",
      title: "Рапорт на відпустку",
      fields: 6,
      popular: true,
      description: "Щорічна, соціальна, за сімейними обставинами. Розрахунок діб, місце проведення.",
      tags: ["відпустка", "дати", "наказ"],
      paper: "А4",
      isActive: true,
      ...(adminUser ? { createdById: adminUser.id } : {}),
      updatedAt: nowTimestamp(),
    },
    update: {
      categoryId: categoryMap.get("raporty") ?? null,
      categorySlug: "raporty",
      title: "Рапорт на відпустку",
      fields: 6,
      popular: true,
      description: "Щорічна, соціальна, за сімейними обставинами. Розрахунок діб, місце проведення.",
      tags: ["відпустка", "дати", "наказ"],
      paper: "А4",
      isActive: true,
      ...(adminUser ? { createdById: adminUser.id } : {}),
      updatedAt: nowTimestamp(),
    },
    conflictOn: { id: "raport-vidpustka" },
  })
  console.log("Seeded 1 template (raport-vidpustka)")

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