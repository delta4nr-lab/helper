import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText, Shield } from "lucide-react"

import { orm } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { getFullName, getInitials } from "@/lib/names"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatBytes, formatDateTime } from "@/lib/format"
import { AccountForm } from "@/components/profile/account-form"
import { ProfileDetailsForm } from "@/components/profile/profile-details-form"
import { ProfileTabs } from "@/components/profile/profile-tabs"
import { ListToolbar } from "@/components/profile/list-toolbar"
import { DocumentsList } from "@/components/profile/documents-list"
import { MediaLibrary } from "@/components/profile/media-library"
import type {
  DocumentItem,
  MediaItem,
  SortOption,
} from "@/components/profile/types"
import { listUserExports, type ExportSort } from "@/lib/db/exports"
import { listUserImages, type MediaSort } from "@/lib/db/images"

export const dynamic = "force-dynamic"

const DOCUMENTS_PAGE_SIZE = 10
const MEDIA_PAGE_SIZE = 12

const DOCUMENT_SORTS: SortOption[] = [
  { value: "newest", label: "Спочатку нові" },
  { value: "oldest", label: "Спочатку старі" },
  { value: "title", label: "За назвою" },
]

const MEDIA_SORTS: SortOption[] = [
  { value: "newest", label: "Спочатку нові" },
  { value: "oldest", label: "Спочатку старі" },
  { value: "name", label: "За назвою" },
]

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    page?: string
    q?: string
    sort?: string
  }>
}) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect("/unauthorized")
  }

  const userId = sessionUser.id
  const role = sessionUser.role ?? "USER"

  const user = await orm.User.where({ id: userId })
    .include("profile", (p) =>
      p.select("lastName", "firstName", "middleName", "rank")
    )
    .first()

  if (!user) redirect("/unauthorized")

  const profile = user.profile
  const initial = getInitials(user.username)

  const params = await searchParams
  const tab = params.tab === "media" ? "media" : "documents"
  const q = (params.q ?? "").trim()
  const requestedPage = parsePage(params.page)
  const requestedSort = params.sort ?? ""

  const documentSort: ExportSort = (
    ["newest", "oldest", "title"] as const
  ).includes(requestedSort as ExportSort)
    ? (requestedSort as ExportSort)
    : "newest"
  const mediaSort: MediaSort = (["newest", "oldest", "name"] as const).includes(
    requestedSort as MediaSort
  )
    ? (requestedSort as MediaSort)
    : "newest"

  // Лічильники для обох вкладок (індекси userId/createdAt).
  const [documentsCountAgg, mediaCountAgg] = await Promise.all([
    orm.ExportedFile.where({ userId }).aggregate((agg) => ({
      count: agg.count(),
    })),
    orm.Image.where({ userId }).aggregate((agg) => ({ count: agg.count() })),
  ])
  const documentsCount = documentsCountAgg.count
  const mediaCount = mediaCountAgg.count

  let documentsPanel: React.ReactNode = null
  let mediaPanel: React.ReactNode = null

  if (tab === "documents") {
    let data = await listUserExports({
      userId,
      q,
      sort: documentSort,
      page: requestedPage,
      pageSize: DOCUMENTS_PAGE_SIZE,
    })
    // Після видалення останнього елемента сторінка могла «зникнути».
    if (data.page > data.totalPages) {
      data = await listUserExports({
        userId,
        q,
        sort: documentSort,
        page: data.totalPages,
        pageSize: DOCUMENTS_PAGE_SIZE,
      })
    }

    const items: DocumentItem[] = data.items.map((item) => ({
      id: item.id,
      title: item.title,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeLabel: formatBytes(item.size),
      createdAtLabel: formatDateTime(item.createdAt),
      templateTitle: item.templateTitle,
    }))

    documentsPanel = (
      <div className="space-y-4">
        <ListToolbar
          tab="documents"
          q={q}
          sort={documentSort}
          sortOptions={DOCUMENT_SORTS}
          placeholder="Пошук за назвою документа..."
        />
        <DocumentsList
          items={items}
          query={{ tab: "documents", q, sort: documentSort, page: data.page }}
          total={data.total}
          totalPages={data.totalPages}
        />
      </div>
    )
  } else {
    let data = await listUserImages({
      userId,
      q,
      sort: mediaSort,
      page: requestedPage,
      pageSize: MEDIA_PAGE_SIZE,
    })
    if (data.page > data.totalPages) {
      data = await listUserImages({
        userId,
        q,
        sort: mediaSort,
        page: data.totalPages,
        pageSize: MEDIA_PAGE_SIZE,
      })
    }

    const items: MediaItem[] = data.items.map((item) => ({
      id: item.id,
      originalFilename: item.originalFilename,
      path: item.path,
      sizeLabel: formatBytes(item.size),
      dimensionsLabel:
        item.width > 0 && item.height > 0
          ? `${item.width}×${item.height}`
          : "—",
      createdAtLabel: formatDateTime(item.createdAt),
    }))

    mediaPanel = (
      <div className="space-y-4">
        <ListToolbar
          tab="media"
          q={q}
          sort={mediaSort}
          sortOptions={MEDIA_SORTS}
          placeholder="Пошук за назвою файлу..."
        />
        <MediaLibrary
          items={items}
          query={{ tab: "media", q, sort: mediaSort, page: data.page }}
          total={data.total}
          totalPages={data.totalPages}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Заголовок профілю */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-12 border shadow-sm">
              <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {user.username}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant={role === "ADMIN" ? "default" : "secondary"}
                  className="rounded-full"
                >
                  <Shield className="size-3" />
                  {role === "ADMIN" ? "Адміністратор" : "Користувач"}
                </Badge>
                {(profile?.lastName || profile?.firstName) && (
                  <span className="text-sm text-muted-foreground">
                    {getFullName(profile ?? {})}
                    {profile?.rank ? ` • ${profile.rank}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link
            href="/templates"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
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
                  ПІБ та звання не обов&apos;язкові. Їх можна заповнити пізніше.
                  Логін має бути унікальним.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Права колонка: документи та медіа */}
          <div>
            <ProfileTabs
              tab={tab}
              q={q}
              sort={tab === "documents" ? documentSort : mediaSort}
              documentsCount={documentsCount}
              mediaCount={mediaCount}
              documents={documentsPanel}
              media={mediaPanel}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
