# Опис функціоналу редактора документа та експорту

Цей документ — точний опис поточної реалізації редактора заповнення документа і експорту
в DOCX. Його можна використовувати як основу для промту агенту: описує архітектуру,
потоки даних, файли, обмеження та поточні нюанси. Мова UI та документів — українська.

---

## 1. Загальна архітектура

```
Шаблон (HTML) ──> composeDocumentHtml() ──> fill-спани (жовті поля) ──> TipTap-редактор
                                                                              │
                              ┌───────────────────────────────────────────────┤
                              ▼                                               ▼
                     Заповнення полів                            Експорт DOCX (server-side)
                     (людина, підпис, зображення)                          │
                              │                                             ▼
                              ▼                                      /api/templates/[id]/export
                       editor.getHTML() ─────────────────────────> createDocxBuffer()
                                                                        │
                                                                        ▼
                                                            ExportedFile (БД) ──> /api/exports/[id]
```

**Ключовий принцип:** редагування відбувається прямо в документі (TipTap), а експорт
отримує вже готовий HTML і конвертує його в DOCX на сервері. Редактор і експорт
використовують спільну модель налаштувань сторінки (`lib/documents/page.ts`) — єдине
джерело істини для розмірів/полів, щоб превʼю та файл збігалися.

---

## 2. Модель сторінки (`lib/documents/page.ts`)

- `PageSettings = { size: "A4", orientation: "portrait" | "landscape", margins: {top,right,bottom,left} }`
- Усі розміри зберігаються в **мм**; конвертери:
  - `mmToPx(mm)` — для CSS (96 dpi)
  - `mmToDxa(mm)` — для DOCX (1 pt = 20 twips, 1 in = 1440 DXA)
- `DEFAULT_PAGE_SETTINGS`: A4, книжкова, поля top 20 / right 10 / bottom 20 / left 20 мм.
- Похідні: `pageSizeMm/Px/Dxa`, `marginsPx/Dxa`, `usableMm/Px/Dxa` (робоча область без полів).
- Серіалізація в localStorage (JSON) через `serializePageSettings` / `parsePageSettings`.
- `pageSettingsFromPaper(paper)` — конвертація `Template.paper` ("А4" | "А4 альбом")
  у `PageSettings` зі стандартними полями.

## 3. Збереження сторінки (`lib/documents/page-store.ts`)

- Збереження налаштувань сторінки **для конкретного шаблону** в localStorage (ключ `page:<templateId>`).
- `readStoredPageSettings` / `writeStoredPageSettings` / `clearStoredPageSettings`.
- Підписка `subscribePageSettings` + `notifyPageSettingsChanged` — для `useSyncExternalStore`
  (після write/clear повідомлення про зміну, щоб редактор одразу перерахував сторінку).

---

## 4. Редактор заповнення (`components/documents/document-editor.tsx`)

Сторінка: `app/templates/[category]/[templateId]/page.tsx` рендерить `<DocumentEditor>`.

### 4.1. Stack і розширення TipTap
- `useEditor` з: `StarterKit` (hr вимкнено, underline іде з StarterKit v3), `TextAlign`,
  `Placeholder`, `FillMark`, `SignatureImageNode`, `ImageNode`, **`TableKitPlus`**
  (tiptap-table-plus — таблиці з пагінацією), `PaginationHistoryGuard`, **`PaginationPlus`**.
- Класи редактора: `document-editor prose prose-sm max-w-none focus:outline-none`.
- `PaginationPlus.configure(...)`:
  - `pageWidth/pageHeight` — з `pageSizePx(page)` (поточні налаштування сторінки)
  - `pageGap: 20`, `pageGapBorderSize: 1`, `pageGapBorderColor: "#e5e5e5"`
  - `pageBreakBackground: "#F7F7F8"`
  - `marginTop/Bottom/Left/Right` — з `marginsPx(page)`
  - `contentMarginTop: 30`, `contentMarginBottom: 30`
  - header/footer **порожні** (не використовуються)
- Синхронізація при зміні сторінки: `updatePageSize({...})` + `updateMargins({...})`.

### 4.2. Початковий вміст
- Сторінка шаблону завантажує з БД `headerTemplate/bodyTemplate/footerTemplate` + `templateFields`
  і збирає початковий контент через `composeDocumentHtml` (у `lib/documents/editor/fill-html.ts`).
- `toEditableHtml()` перетворює:
  - `<span data-field-key=...>` → `fill-спан` (жовтий)
  - плейсхолдери `{{key}}` → `fill-спан`
- Результат — спани `span[data-fill-key][data-fill-type][data-fill-label]` з текстом-підписом.

### 4.3. Поля заповнення (FillMark, `lib/documents/editor/fill-mark.ts`)
- `FillMark` — не-атомна марка з атрибутами `fillKey`, `fillType`, `fillLabel`, `personId`.
- Рендериться як `span.field-chip.field-chip--editable` (жовтий блок). Вміст можна друкувати.
- Клік по незаповненому полю (текст = label) → виділення всього діапазону, щоб друк одразу замінив підпис.

### 4.4. Типи спеціальних полів і групування
- `SPECIAL_FIELD_TYPES = {signature, rank, person, position}`.
- **Група полів:** поля з однаковим числовим суфіксом (`field_1`) по всьому документу;
  поля без суфікса групуються за блоком (абзац/комірка).
- `applyPerson(personId, target)` — вибір особи зі штату заповнює всю групу:
  - `person` → ПІБ (імʼя + по-батькові + прізвище)
  - `position` → посада
  - `rank` → звання
  - `signature` → зображення підпису (`SignatureImageNode`) або ZWSP (порожнє поле)
- `clearGroup` — скидає групу до підписів полів; `clearSignature` — лише видаляє підпис.
- `updateGroupFields(suffix, update, anchorPos)` — центральна функція: знаходить усі
  fill-поля групи (обхід ProseMirror-дерева), застосовує `update` і перезаписує діапазони.

### 4.5. Вибір особи (PersonPicker)
- `components/documents/person-picker.tsx` — поповер (`@base-ui/react/popover`).
- При наведенні миші на спеціальне поле зʼявляється тригер (`PersonPicker`), позиціонується
  над полем (координати відносно контейнера сторінок `contentWrapRef`).
- Показує список осіб зі штату (фільтрація: якщо група привʼязана до особи, для
  position/rank/signature показується лише ця особа; для person — весь штат).
- Меню має дії: обрати особу, очистити групу, очистити підпис.

### 4.6. Зображення документа (ImageNode, `lib/documents/editor/image-extension.tsx`)
- `ImageNode` — блоковий атом з атрибутами: `imageId`, `src`, `widthMm`, `heightMm`,
  `align` (left/center/right), `pageBreakBefore`.
- NodeView: `img` з фізичними розмірами (mm→px), контейнер `.doc-image-node`,
  вирівнювання `.doc-image-align-*`, маркери ресайзу `.doc-image-handle--*` (4 кути),
  outline при виборі `[data-selected]`.
- При `pageBreakBefore` додається `data-page-break` та `breakBefore: page`.
- **Вставка** (`insertImage`): зображення додається в кінець документа з
  `data-page-break="true"` (розрив сторінки для PaginationPlus), початковий розмір =
  ширина робочої області (mm), дрібні не збільшуються.
- **Редагування обраного зображення** (панель над зображенням, позиція з `coordsAtPos`):
  - ширина/висота в мм (з опцією збереження пропорцій)
  - вирівнювання (ліво/центр/право)
  - замінити (через ImagePicker), видалити
- **Drop/Paste** зображення в редактор → upload + insert.

### 4.7. ImagePicker і бібліотека зображень
- `components/documents/image-picker.tsx` — діалог з 2 вкладками:
  - **Завантажити:** drag&drop або вибір файлу (JPG/PNG/WEBP, до 10 МБ), превʼю,
    прогрес завантаження, потім одразу вставка.
  - **Мої зображення:** список зображень користувача (пошук за іменем, пагінація),
    вибір → вставка.
- API:
  - `POST /api/images/upload` — збереження файлу в `public/uploads/users/{userId}/images/`,
    запис у `Image`, визначення розмірів (PNG/JPEG/WEBP без бібліотек).
  - `GET /api/images?q=&page=&pageSize=` — список власних зображень.

### 4.8. Налаштування сторінки
- `PageSettingsDialog` — формат (A4), орієнтація, поля (мм, 0–50, крок 0.5).
- Застосування зберігається в localStorage (за templateId) і синхронізується з
  PaginationPlus через `updatePageSize` + `updateMargins`.

### 4.9. Підписи (SignatureImageNode)
- `lib/documents/editor/signature-image.ts` — inline-атом `signatureImage` всередині
  fill-марки підпису. Рендериться як zero-width слот `span.signature-slot` + `img.signature-img`
  (зображення позиціоноване поверх, не рухає текст/таблиці).

### 4.10. Історія undo/redo (PaginationHistoryGuard)
- `lib/documents/editor/history-guard.ts` — розширення з `filterTransaction`:
  службові транзакції PaginationPlus (meta `PAGE_COUNT_META_KEY`) позначаються
  `addToHistory: false`, щоб вони не «з'їдали» redo-стек.

---

## 5. Експорт у DOCX

### 5.1. Маршрут: `POST /api/templates/[templateId]/export`
Етапи:
1. Авторизація (сесія) — інакше 401.
2. Валідація `templateId`; `body = { html, page }`.
3. Санітизація `page` (A4, поля 0–50 мм; інакше — значення шаблону).
4. Розбір HTML (cheerio): знаходження `span[data-fill-type="signature"]`, збір `personIds`.
5. Завантаження осіб із БД; для кожного підпису з `person.signaturePath` (не .webp —
   Word не вбудовує WEBP) читаємо файл → `SignatureImage {name, buffer, mime}`.
6. Трансформація: підпис → `<img data-sig="key">` (лише зображення, без ПІБ);
   без файлу — span видаляється. Видаляються залишкові елементи редактора
   (`span[data-signature]`, `img[data-signature]`).
7. `createDocxBuffer({ title, body: processedHtml, data: {}, page, signatureImages })`.
8. Запис результату в `ExportedFile` (БД), відповідь `{ id, fileName, downloadUrl }`.

### 5.2. Завантаження: `GET /api/exports/[id]`
- Авторизація; доступ лише власнику або ADMIN.
- Повертає файл з `Content-Disposition: attachment`, кодуванням імені.

### 5.3. `createDocxBuffer` (`lib/documents/export/docx.ts`)
Конвертує HTML → DOCX (пакет `docx`):
- **Підпис (`data-sig`)** → плаваюче `ImageRun` «перед текстом», справа по полю,
  по центру рядка; висота 72px (≈4em), ширина за пропорціями файлу (читає PNG/JPEG header).
- **Зображення (`/uploads/...`)** → `ImageRun` з розмірами `data-width-mm`/`data-height-mm`
  (mm→px), вирівнювання `data-align`; `data-page-break="true"` → `pageBreakBefore`.
- **Таблиці** → `extractTableModel` → `Table` з colspan/rowspan, фіксованою шириною,
  межами (звичайні чорні або borderless), вертикальним вирівнюванням top, полями комірок.
- **Абзаци**: text-align, heading (h1-h3), `font-size` (px→pt→half-points), `font-family`,
  `text-indent` (червоний рядок, px/pt/cm/mm → DXA), br, списки (ul → bullet, ol → numbering).
- **Порожні `<p>`** → порожній Paragraph (збереження порожніх рядків).
- Секції: розмір сторінки (DXA) + поля (DXA); landscape обмінюється шириною/висотою.
- Шрифт за замовчуванням: Times New Roman 14pt (28 half-points).

### 5.4. `extractTableModel` (`lib/documents/export/parse-tables.ts`)
- Модель таблиці для docx (архітектурно — для excel/pdf теж):
  `{ isBorderless, width: {size, mode}, colWidthsDxa, colWidthsFixed, rows }`.
- Режими ширини: `fixed` (точні px → 1:1), `percent` (% від робочої ширини),
  `auto` (вся ширина аркуша).
- Ширини колонок: пріоритет `colgroup/col` → перший ряд `td/th`; розподіл зі збереженням
  фіксованих колонок; корекція суми до ширини таблиці.
- `DXA_PER_PX = 15` (1in=1440, 96dpi). Утиліти `dxaToPx`, `dxaToPt`.

---

## 6. Спільні CSS-класи (globals.css)

- `.doc-workspace` — робоча область редактора (темний фон, центрування, скрол).
- `.document-editor` + `.document-editor table` — таблиці, комірки, resize-ручки, selectedCell.
- `.field-chip`, `.field-chip--editable`, `.field-chip--editable:has(.signature-slot)`.
- `.signature-slot`, `.signature-img`.
- `.doc-image-node`, `.doc-image-align-*`, `.doc-image-node[data-selected]`, `.doc-image-handle*`.

Стилі самих сторінок/розривів пагінації — **власні від `tiptap-pagination-plus`**
(класи `.rm-with-pagination`, `.rm-page-break`, `.page`, `.rm-pagination-gap`), їх не перебиваємо.

---

## 7. Обмеження та поточні нюанси

- **Тільки DOCX.** Експорт реалізовано лише для DOCX. Excel/PDF — окремі плани.
- **WEBP** не вбудовується в DOCX (ні зображення документа, ні підписи) — пропускається.
- **Підпис**: без файлу підпису виводиться лише імʼя; з файлом — зображення без ПІБ.
- **Поля полів**: 0–50 мм, орієнтація книжкова/альбомна, тільки A4.
- **Спеціальні поля** групуються за числовим суфіксом або блоком.
- Пагінація в редакторі — `tiptap-pagination-plus` + `tiptap-table-plus` (розбиття таблиць на сторінки).
- Розмір завантаження зображень — до 10 МБ, типи JPG/PNG/WEBP.
- Безпека: доступ до зображень/експорту — лише власник або ADMIN; userId береться з сесії,
  ніколи з тіла запиту.
- Мова: усі тексти UI, повідомлення, імена файлів — українські.

---

## 8. Ключові файли

| Файл | Роль |
|------|------|
| `components/documents/document-editor.tsx` | Редактор заповнення (UI + логіка) |
| `components/documents/image-picker.tsx` | Діалог вставки/бібліотеки зображень |
| `components/documents/page-settings-dialog.tsx` | Налаштування сторінки |
| `components/documents/person-picker.tsx` | Вибір особи зі штату |
| `lib/documents/page.ts` | Модель сторінки + конвертери |
| `lib/documents/page-store.ts` | localStorage сторінки по шаблону |
| `lib/documents/editor/fill-html.ts` | HTML шаблону → fill-спани |
| `lib/documents/editor/fill-mark.ts` | FillMark (жовті поля) |
| `lib/documents/editor/signature-image.ts` | Підпис inline-вузол |
| `lib/documents/editor/image-extension.tsx` | ImageNode (зображення документа) |
| `lib/documents/editor/history-guard.ts` | Захист undo/redo від службових транзакцій |
| `lib/documents/export/docx.ts` | HTML → DOCX buffer |
| `lib/documents/export/parse-tables.ts` | Модель таблиці для експорту |
| `app/api/templates/[templateId]/export/route.ts` | Серверний експорт |
| `app/api/exports/[id]/route.ts` | Завантаження файлу |
| `app/api/images/upload/route.ts`, `app/api/images/route.ts` | Бібліотека зображень |
| `app/globals.css` | Спільні стилі редактора/експорту |