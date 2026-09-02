import { Extension } from "@tiptap/core"

const PAGE_COUNT_META_KEY = "PAGE_COUNT_META_KEY"

// PaginationPlus після кожної зміни dispatch-ить службову транзакцію
// з meta PAGE_COUNT_META_KEY (перерахунок сторінок/колонтитулів).
// Якщо вона потрапляє в історію ProseMirror — «з'їдає» redo-стек.
// Використовуємо офіційний хук dispatchTransaction (TipTap v3),
// щоб позначити такі транзакції addToHistory: false до того,
// як вони дійдуть до view/history.
export const PaginationHistoryGuard = Extension.create({
  name: "paginationHistoryGuard",

  // Запускаємо рано, щоб meta встигла потрапити до history-плагіна
  priority: 1000,

  dispatchTransaction({ transaction, next }) {
    if (transaction.getMeta(PAGE_COUNT_META_KEY) !== undefined) {
      transaction.setMeta("addToHistory", false)
    }
    next(transaction)
  },
})