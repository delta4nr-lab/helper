import { ForbiddenView } from "@/components/forbidden-view"

export const metadata = {
  title: "401 — Необхідна авторизація",
}

export default function UnauthorizedPage() {
  return <ForbiddenView variant="unauthorized" />
}
