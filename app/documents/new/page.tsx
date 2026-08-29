import { redirect } from "next/navigation"

// Старі закладки ведуть на попередній шлях редактора шаблонів.
export default function LegacyNewDocumentPage() {
  redirect("/admin/templates/new")
}
