import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText, Shield } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { AccountForm } from "@/components/profile/account-form"
import { ProfileDetailsForm } from "@/components/profile/profile-details-form"
import { DocumentsLog } from "@/components/profile/documents-log"

export const dynamic = "force-dynamic"

function avatarFallback(username: string): string {
  return username.trim().charAt(0).toUpperCase() || "?"
}

export default async function ProfilePage() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; username?: string; role?: string; name?: string | null } } | null>)()
  if (!session?.user?.id) {
    redirect("/")
  }

  const userId = (session.user as unknown as { id: string }).id
  const role = (session.user as unknown as { role: string }).role ?? "USER"

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  })

  if (!user) redirect("/")

  const documents = await prisma.document.findMany({
    where: { authorId: userId },
    include: { template: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const profile = user.profile
  const initial = avatarFallback(user.username)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Заголовок профілю */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-12 border shadow-sm">
              <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">{initial}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{user.username}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={role === "ADMIN" ? "default" : "secondary"} className="rounded-full">
                  <Shield className="size-3" />
                  {role === "ADMIN" ? "Адміністратор" : "Користувач"}
                </Badge>
                {(profile?.lastName || profile?.firstName) && (
                  <span className="text-sm text-muted-foreground">
                    {[profile?.lastName, profile?.firstName, profile?.middleName].filter(Boolean).join(" ")}
                    {profile?.rank ? ` • ${profile.rank}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href="/templates" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <FileText className="size-4" />
            Створити документ
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Ліва колонка: форми */}
          <div className="flex flex-col gap-6">
            <AccountForm username={user.username} />

            <ProfileDetailsForm
              profile={{
                lastName: profile?.lastName ?? null,
                firstName: profile?.firstName ?? null,
                middleName: profile?.middleName ?? null,
                rank: profile?.rank ?? null,
              }}
            />

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Підказка</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  ПІБ та звання не обов&apos;язкові. Їх можна заповнити пізніше — вони підставляються у шаблони рапортів та наказів. Логін
                  має бути унікальним.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Права колонка: лог документів */}
          <div className="flex flex-col gap-6">
            <DocumentsLog
              documents={documents.map((d) => ({
                id: d.id,
                title: d.title,
                status: d.status,
                categorySlug: d.categorySlug,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt,
                template: d.template ? { title: d.template.title } : null,
              }))}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Статистика</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-lg font-semibold leading-none">{documents.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">всього</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-lg font-semibold leading-none">{documents.filter((d) => d.status === "чернетка").length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">чернеток</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-lg font-semibold leading-none">{documents.filter((d) => d.status === "підписано").length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">підписано</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
