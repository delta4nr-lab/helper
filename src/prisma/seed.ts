import "dotenv/config"
import bcrypt from "bcrypt"
import { db, orm, nowTimestamp } from "./db"

// Сід для чистого розгортання: створює лише користувачів (без демо-категорій,
// демо-особового складу чи шаблонів). Паролі можна задати через
// ADMIN_PASSWORD / USER_PASSWORD.
async function main() {
  console.log(
    "Seeding users (admin creates others, profile = ПІБ + звання, аватар = літера)..."
  )
  const users = [
    {
      username: "admin",
      password: process.env.ADMIN_PASSWORD || "Admin123",
      role: "ADMIN" as const,
      profile: {
        lastName: "Адміністратор",
        firstName: "Системи",
        middleName: null,
        rank: "адмін",
      },
    },
    {
      username: "user",
      password: process.env.USER_PASSWORD || "User123",
      role: "USER" as const,
      profile: {
        lastName: "Петренко",
        firstName: "Іван",
        middleName: "Васильович",
        rank: "капітан",
      },
    },
    {
      username: "kovalchuk",
      password: "Koval123",
      role: "USER" as const,
      profile: {
        lastName: "Ковальчук",
        firstName: "Олена",
        middleName: "Миколаївна",
        rank: "ст. лейтенант",
      },
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
    console.log(
      ` - ${u.username} (${u.role}) -> profile: ${u.profile.lastName} ${u.profile.firstName}, rank: ${u.profile.rank}`
    )
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
