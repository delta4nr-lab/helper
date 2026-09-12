// RuntimeTransaction — базова абстракція для майбутніх складних Runtime-
// операцій (обгортка послідовності Runtime-дій).
//
// У public API @docx-editor.dev/core (2.16.0/2.16.1) НЕМАЄ відкритої
// transaction-одиниці для складних дій: кожен exec — окремий шаг з власною
// undo-одиницею рушія. Тому СТРОГО за вимогами:
//   - НЕ імітуємо transaction фальшивою системою undo/redo;
//   - НЕ робимо власних snapshot-ів документа;
//   - цей модуль — ЛИШЕ послідовний виконувач Runtime-дій з однією точкою
//     обробки помилок. Коли editor надасть нативну transaction-поверхню,
//     саме метод run() стане точкою інтеграції.
//
// Помилка всередині дій перериває їх і повертається викликачу —
// групування, а не фейкова атомарність (частково виконані кроки лишаються
// історією редактора, і викликач пристосує поведінку сам).

export type RuntimeTxContext = {
  /** Редактор, над яким виконується серія дій (джерело exec/query API) */
  readonly editor: unknown
}

export type TransactionResult<TReturn> =
  | { readonly ok: true; readonly value: TReturn }
  | { readonly ok: false; readonly error: unknown }

export class RuntimeTransaction {
  private readonly editor: unknown

  constructor(editor: unknown) {
    this.editor = editor
  }

  /**
   * Виконує серію Runtime-дій як один плин. Результат callback — або
   * точна помилка. НЕ undo: спеціального rollback немає ( movimiento
   * публічного transaction API редактор немає — зафіксовано).
   */
  async run<TReturn>(
    actions: (tx: RuntimeTxContext) => Promise<TReturn> | TReturn
  ): Promise<TransactionResult<TReturn>> {
    try {
      const value = await actions({ editor: this.editor })
      return { ok: true, value }
    } catch (error) {
      return { ok: false, error }
    }
  }
}
