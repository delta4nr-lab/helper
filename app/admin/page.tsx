import Link from "next/link"
import { FileText, Folder, Users, UsersRound } from "lucide-react"

import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  // Auth перевіряється в app/admin/layout.tsx (middleware + server layout)
  const [usersTotal, exportsTotal, categoriesTotal, templatesTotal] =
    await Promise.all([
      prisma.user.count(),
      prisma.exportedFile.count(),
      prisma.category.count(),
      prisma.template.count({ where: { isActive: true } }),
    ])

  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">ADMIN</Badge>
              <span className="text-xs text-muted-foreground">
                Керування системою
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Огляд</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Швидкий доступ до основних довідників системи.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Користувачі</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {usersTotal}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Users className="size-3.5" />
                  Керувати користувачами
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                  <CardDescription>Експорти</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {exportsTotal}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Збережені файли користувачів
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Категорії</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {categoriesTotal}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/categories"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Folder className="size-3.5" />
                  Керувати категоріями
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Активні шаблони</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {templatesTotal}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Доступні для створення документів
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Швидкі дії</CardTitle>
              <CardDescription>Оберіть розділ для роботи.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/users" />}
              >
                <Users className="size-4" />
                Користувачі
              </Button>

              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/categories" />}
              >
                <Folder className="size-4" />
                Категорії
              </Button>

              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/personnel" />}
              >
                <UsersRound className="size-4" />
                Штат
              </Button>

              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/templates" />}
              >
                <FileText className="size-4" />
                Керувати шаблонами
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
