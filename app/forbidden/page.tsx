import { ForbiddenView } from "@/components/forbidden-view"

export const metadata = {
  title: "403 — Доступ заборонено",
}

export default function ForbiddenPage() {
  return <ForbiddenView variant="forbidden" />
}
