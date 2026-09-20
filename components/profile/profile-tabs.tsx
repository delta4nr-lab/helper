"use client"

import * as React from "react"
import { useRouter } from "@bprogress/next/app"
import { FileText, ImageIcon } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { buildProfileHref } from "@/lib/profile/query"
import type { ListQuery } from "@/components/profile/types"

function CountPill({
  children,
  active,
}: {
  children: React.ReactNode
  active: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-primary/10 text-primary"
      )}
    >
      {children}
    </span>
  )
}

export function ProfileTabs({
  tab,
  q,
  sort,
  documentsCount,
  mediaCount,
  documents,
  media,
}: {
  tab: ListQuery["tab"]
  q: string
  sort: string
  documentsCount: number
  mediaCount: number
  documents: React.ReactNode
  media: React.ReactNode
}) {
  const router = useRouter()

  const items = [
    {
      value: "documents" as const,
      label: "Документи",
      icon: FileText,
      count: documentsCount,
      description:
        "Збережені вами документи: перегляд, завантаження та видалення.",
    },
    {
      value: "media" as const,
      label: "Медіа",
      icon: ImageIcon,
      count: mediaCount,
      description: "Файли, додані в документи: перегляд та видалення.",
    },
  ]
  const activeItem = items.find((item) => item.value === tab) ?? items[0]

  return (
    <Tabs
      value={tab}
      onValueChange={(next) =>
        router.replace(
          buildProfileHref({ tab: next as ListQuery["tab"], q, sort })
        )
      }
    >
      <TabsList className="h-10! w-full rounded-xl p-1 sm:w-auto">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="gap-2 px-4 text-sm text-foreground/70 sm:flex-none dark:text-foreground/70"
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
              <CountPill active={tab === item.value}>{item.count}</CountPill>
            </TabsTrigger>
          )
        })}
      </TabsList>

      <p className="text-xs text-muted-foreground">{activeItem.description}</p>

      <TabsContent value="documents" className="outline-none">
        {documents}
      </TabsContent>
      <TabsContent value="media" className="outline-none">
        {media}
      </TabsContent>
    </Tabs>
  )
}
