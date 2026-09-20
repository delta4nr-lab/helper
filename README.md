# Канцелярія (helper)

Веб-застосунок для створення та керування військовою документацією: шаблони
документів, особовий склад, курси курсантів, медіатека та експорт. Інтерфейс і
згенеровані документи — українською.

- **Призначення:** пришвидшити підготовку типових військових документів —
  заповнити кілька полів у готовому шаблоні замість ручного форматування.
- **Аудиторія:** стройова та кадрова служба.
- **Підхід:** дані структуровані (контракт БД + схеми), бізнес-логіка окремо від
  UI, вся авторизація — на сервері.

---

## Зміст

1. [Можливості](#можливості)
2. [Ролі та права](#ролі-та-права)
3. [Стек](#стек)
4. [Вимоги](#вимоги)
5. [Швидкий старт](#швидкий-старт)
6. [Змінні середовища](#змінні-середовища)
7. [Скрипти](#скрипти)
8. [Структура проєкту](#структура-проєкту)
9. [Маршрути сторінок](#маршрути-сторінок)
10. [API](#api)
11. [База даних і міграції](#база-даних-і-міграції)
12. [Моделі даних](#моделі-даних)
13. [DOCX-редактор](#docx-редактор)
14. [Курси та Excel-імпорт](#курси-та-excel-імпорт)
15. [Авторизація та безпека](#авторизація-та-безпека)
16. [Потоки даних](#потоки-даних)
17. [Обробка помилок](#обробка-помилок)
18. [Продуктивність і кешування](#продуктивність-і-кешування)
19. [Перевірки якості](#перевірки-якості)
20. [Конвенції розробки](#конвенції-розробки)
21. [Відомі обмеження](#відомі-обмеження)
22. [FAQ / Troubleshooting](#faq--troubleshooting)
23. [Helper (English)](#helper-english)

---

## Можливості

### Каталог шаблонів
- Категорії з описом, порядком і видимістю; шаблони з тегами, папером (A4 / A4
  альбом) та позначкою «популярний».
- Живий пошук по всьому каталогу (`/api/templates/search`) на головній сторінці.
- Fallback: якщо БД недоступна або порожня — використовується статичний каталог
  `lib/documents/catalog.ts`.

### DOCX-редактор
- Вбудований редактор `docx-editor.dev` (Word-like) з меню, тулбаром, прев'ю.
- Кастомні поля-плейсхолдери (Content Controls) для персональних даних і
  курсантів, прив'язка конкретних людей, повторення рядків таблиць.
- Вставка зображень (завантаження або бібліотека), підписів особового складу.
- Збереження шаблону та експорт заповненого документа в DOCX.

### Особовий склад
- Список людей, які підписують документи: ПІБ, звання, посада, статус, підпис
  (PNG/JPEG, до 2 МБ).

### Курси курсантів
- Імпорт списку з Excel (`.xlsx`, до 15 МБ), редагування 37 полів запису,
  кілька направлень на курсанта, активний курс для сайту.

### Експорт і медіатека
- Історія експортів користувача з пошуком, сортуванням, пагінацією,
  перейменуванням і видаленням.
- Бібліотека зображень користувача (JPG/PNG/GIF/WEBP, до 10 МБ).

### Профіль та адмінка
- Профіль: зміна логіна/пароля, ПІБ і звання.
- Адмін-панель: користувачі, категорії, шаблони, штат, курси.

## Ролі та права

| Ресурс / дія | Анонім | `USER` | `ADMIN` |
| --- | :---: | :---: | :---: |
| Головна `/`, каталог `/templates`, `/search` | ✅ | ✅ | ✅ |
| Перегляд шаблону `/templates/[category]/[templateId]` | ✅ (без ПІБ) | ✅ (з ПІБ) | ✅ |
| Редагування документа + експорт у свою історію | ❌ | ✅ | ✅ |
| Профіль `/profile` | ❌ | ✅ | ✅ |
| Читання підписів `/signature/[file]` | ❌ | ✅ | ✅ |
| Читання власних зображень `/uploads/...` | ❌ | ✅ (свої) | ✅ (усі) |
| Адмін-панель `/admin/**` | ❌ | ❌ | ✅ |
| Керування шаблонами/категоріями/штатом/курсами | ❌ | ❌ | ✅ |
| Завантаження підписів `/api/signature/upload` | ❌ | ❌ | ✅ |

## Стек

| Шар | Технології |
| --- | --- |
| Фреймворк | Next.js 16.2.6 (App Router, Turbopack, Server Components/Actions) |
| UI | React 19.2.4, Tailwind CSS 4, shadcn/ui (стиль `base-nova`, Base UI), lucide-react, sonner |
| Мова | TypeScript 5 (strict), Zod 4 |
| Дані | Prisma Next 8 (`@prisma/orm-postgres`, contract-first), PostgreSQL |
| Авторизація | Auth.js / NextAuth 5 (Credentials, JWT), bcrypt |
| Документи | docx-editor.dev 2.16, docx-preview, JSZip, exceljs |

## Вимоги

- **Node.js 20+**
- **PostgreSQL 15+**
- **npm**

## Швидкий старт

```bash
# 1. Залежності
npm install

# 2. Середовище
cp .env.example .env.local   # заповніть DATABASE_URL і AUTH_SECRET

# 3. Контракт + схема БД
npm run contract:emit
npx prisma db init           # перший раз (bootstrap + sign)
# після наступних змін контракту: npx prisma db update

# 4. Користувачі (сід створює лише облікові записи)
npm run db:seed

# 5. Дев-сервер
npm run dev                  # http://localhost:3000
```

Користувачі після сіду (демо-категорії, особовий склад і шаблони не створюються):

| Логін | Пароль | Роль |
| --- | --- | --- |
| `admin` | `Admin123!` (або `ADMIN_PASSWORD`) | `ADMIN` |
| `user` | `User123!` (або `USER_PASSWORD`) | `USER` |
| `kovalchuk` | `Koval123!` | `USER` |

## Змінні середовища

| Змінна | Обов'язкова | Призначення |
| --- | :---: | --- |
| `DATABASE_URL` | ✅ | Рядок підключення PostgreSQL |
| `DIRECT_URL` | ➖ | Пряме підключення (Vercel / Prisma Postgres) |
| `AUTH_SECRET` | ✅ | Секрет NextAuth (`npx auth secret` / `openssl rand -hex 32`) |
| `AUTH_TRUST_HOST` | ➖ | Довіра до хоста за проксі (увімкнено в `auth.ts`) |
| `ADMIN_PASSWORD` | ➖ | Пароль адміна для `db:seed` |
| `USER_PASSWORD` | ➖ | Пароль демо-користувача для `db:seed` |
| `UPLOADS_DIR` | ➖ | Каталог приватних аплоадів (типово `<cwd>/storage`) |

## Скрипти

| Команда | Дія |
| --- | --- |
| `npm run dev` | Дев-сервер Next.js |
| `npm run build` | Продакшн-збірка |
| `npm run start` | Запуск продакшн-збірки |
| `npm run lint` | ESLint |
| `npm run typecheck` | Перевірка типів (`tsc --noEmit`) |
| `npm run format` | Форматування Prettier |
| `npm run contract:emit` | Перегенерувати `contract.json` / `contract.d.ts` |
| `npm run db:seed` | Створити користувачів (admin, user, kovalchuk) |

## Структура проєкту

```text
app/
  layout.tsx                      кореневий layout (шрифти, провайдери, Toaster)
  page.tsx                        головна (hero, можливості, каталог, CTA)
  admin/
    layout.tsx                    серверна перевірка ADMIN + спільний chrome
    page.tsx                      огляд (лічильники)
    users|personnel|categories|courses|templates/  розділи адмінки
    templates/[templateId]/       редактор шаблона
  templates/
    page.tsx                      каталог категорій
    [category]/page.tsx           шаблони категорії
    [category]/[templateId]/      перегляд/заповнення документа
  profile/
    page.tsx                      профіль (документи, медіа)
    actions.ts                    server actions профілю
  search/page.tsx                 пошук по каталогу
  forbidden|unauthorized/         сторінки 403/401
  api/
    auth/[...nextauth]/route.ts   Auth.js handlers
    exports/route.ts              POST: зберегти експорт
    exports/[id]/route.ts         GET: завантажити/прев'ю; ?anchors=1, ?inline=1
    images/route.ts               GET: бібліотека зображень користувача
    images/upload/route.ts        POST: завантажити зображення
    signature/upload/route.ts     POST: завантажити підпис (ADMIN)
    templates/[templateId]/docx/route.ts        GET: DOCX шаблона; ?word=1
    templates/[templateId]/docx-preview/route.ts GET: публічне прев'ю DOCX
    templates/search/route.ts     GET: пошук шаблонів
    admin/templates/[templateId]/docx/route.ts  GET: DOCX для адмін-редактора
  uploads/[...path]/route.ts      GET: приватна роздача зображень (auth)
  signature/[file]/route.ts       GET: приватна роздача підписів (auth)
components/
  ui/                             базові компоненти shadcn/ui
  shared/                         EmptyState, ConfirmDelete, FormStatus, SubmitButton
  site-header|site-footer|theme-* спільний каркас
  auth/                           auth-modal, auth-provider, user-menu
  admin/                          менеджери розділів адмінки
  profile/                        профіль: списки, форми, медіа, пагінація
  templates/                      каталог: картки, пошук, фільтр
  site/preview-doc.tsx            прев'ю DOCX через docx-preview
  documents/docx-editor/          DOCX-редактор (рушійні інтеграції)
lib/
  db.ts                           re-export db/orm/nowTimestamp
  db/                             запити за доменами (exports, images, templates)
  auth.ts                         getSessionUser / getAdminId / requireAdminId
  validation.ts                   правила логіну/пароля, SALT_ROUNDS
  names/index.ts                  getFullName / getInitials
  format.ts                       formatBytes / formatDateTime
  storage/paths.ts                приватні каталоги аплоадів
  documents/                      filename, sanitize-docx, anchors, docx-zip
  docx-editor/                    field-node, repeat-row, table-row-duplicate, uk
  templates|courses|personnel|categories|users/  доменні модулі
  profile/query.ts                buildProfileHref
src/prisma/
  contract.prisma                 джерело істини схеми
  contract.json / contract.d.ts   згенеровані (не редагувати вручну)
  db.ts                           postgres<Contract>(...), orm
  seed.ts                         сід
migrations/
  app/<timestamp>_<name>/         версійовані міграції
  snapshots/<hash>/               контракт-знімки (використовуються міграціями)
  app/refs/db.json                реф поточного стану БД
auth.ts                           конфігурація NextAuth
proxy.ts                          middleware (захист /admin, /profile)
prisma.config.ts                  конфігурація Prisma CLI
next.config.ts                    конфігурація Next.js
```

## Маршрути сторінок

| Шлях | Доступ | Призначення |
| --- | --- | --- |
| `/` | публічний | Головна: огляд, можливості, каталог, прев'ю |
| `/templates` | публічний | Каталог категорій |
| `/templates/[category]` | публічний | Шаблони однієї категорії |
| `/templates/[category]/[templateId]` | публічний | Редактор/заповнення (ПІБ лише авторизованим) |
| `/search` | публічний | Пошук по каталогу |
| `/profile` | авторизований | Профіль, документи, медіа |
| `/admin` | `ADMIN` | Огляд адмінки |
| `/admin/users` | `ADMIN` | Користувачі |
| `/admin/personnel` | `ADMIN` | Особовий склад і підписи |
| `/admin/categories` | `ADMIN` | Категорії |
| `/admin/courses` | `ADMIN` | Курси та записи курсантів |
| `/admin/templates` | `ADMIN` | Шаблони |
| `/admin/templates/[templateId]` | `ADMIN` | Редактор шаблона |
| `/forbidden` | публічний | 403 |
| `/unauthorized` | публічний | 401 |

## API

| Метод | Шлях | Доступ | Опис |
| --- | --- | --- | --- |
| `POST` | `/api/exports` | авторизований | Зберегти заповнений DOCX в історію. `FormData: templateId, title, file` |
| `GET` | `/api/exports/[id]` | власник/ADMIN | Завантажити (`attachment`) або прев'ю (`?inline=1`); `?anchors=1` — позиції плаваючих зображень |
| `GET` | `/api/images` | авторизований | Список власних зображень. `?q&page&pageSize` |
| `POST` | `/api/images/upload` | авторизований | Завантажити зображення. `FormData: file` |
| `POST` | `/api/signature/upload` | `ADMIN` | Завантажити підпис. `FormData: file` |
| `GET` | `/api/templates/[templateId]/docx` | авторизований | DOCX активного шаблона; `?word=1` додає плейсхолдери |
| `GET` | `/api/templates/[templateId]/docx-preview` | публічний | Байти DOCX для прев'ю (кеш 10 хв) |
| `GET` | `/api/templates/search` | публічний | Пошук шаблонів. `?q&limit` (≤20) |
| `GET` | `/api/admin/templates/[templateId]/docx` | `ADMIN` | DOCX для адмін-редактора (незалежно від `isActive`) |
| `GET` | `/uploads/[...path]` | авторизований | Приватна роздача зображень (`storage/uploads`) |
| `GET` | `/signature/[file]` | авторизований | Приватна роздача підписів (`storage/signature`) |
| `GET/POST` | `/api/auth/[...nextauth]` | — | Обробники Auth.js |

Приклади:

```bash
# Пошук шаблонів
curl "http://localhost:3000/api/templates/search?q=рапорт&limit=5"

# Завантажити експорт (потрібна сесія/cookie)
curl -O -b cookies.txt "http://localhost:3000/api/exports/<id>?inline=1"
```

## База даних і міграції

Проєкт використовує **Prisma Next (contract-first)**: джерело істини —
`src/prisma/contract.prisma`. Робочі артефакти `contract.json` та `contract.d.ts`
генеруються командою `npm run contract:emit` і вручну не редагуються.

Робочий цикл зміни схеми:

```bash
# 1) Змінити contract.prisma
# 2) Перегенерувати контракт
npm run contract:emit

# 3) Спланувати міграцію (offline, не чіпає БД)
npx prisma migration plan --name <назва>

# 4) Застосувати до БД
npx prisma db migrate

# 5) Перевірити відповідність
npx prisma db verify
npx prisma migration check
```

Контрольні команди: `npx prisma migration status`, `npx prisma migration graph`,
`npx prisma migration log`. Реф поточного стану БД — `migrations/app/refs/db.json`.

> Поточний ланцюг міграцій (лінійний):
> `baseline → add_courses → drop_template_fields → add_medical_referral → add_lookup_indexes`.

## Моделі даних

`enum Role { ADMIN, USER }`. Усі `id` — `String`, генеруються `nanoid()`; часові
поля — `TimestampString(3)` (default `now()`).

### Category
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `slug` | String | unique |
| `title` | String | |
| `description` | String | |
| `longDescription` | String? | |
| `icon` | String? | |
| `countLabel` | String | default `"шаблонів"` |
| `sortOrder` | Int | default `0` |
| `isActive` | Boolean | default `true` |
| `createdAt` / `updatedAt` | Timestamp | |
| `templates` | Template[] | 1:N |

Індекси: `(isActive, sortOrder)`.

### User
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `username` | String | unique |
| `password` | String | bcrypt |
| `role` | Role | default `USER` |
| `isActive` | Boolean | default `true` |
| `createdAt` / `updatedAt` | Timestamp | |
| `profile` | Profile? | 1:1 |
| `templates`, `exportedFiles`, `images` | — | 1:N |

Індекси: `(role)`.

### Profile
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `userId` | String | unique, FK → User (cascade) |
| `lastName` / `firstName` / `middleName` | String? | |
| `rank` | String? | |
| `createdAt` / `updatedAt` | Timestamp | |

### Template
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `categorySlug` | String | |
| `title` | String | |
| `fields` | Int | кількість полів (метрика) |
| `popular` | Boolean | default `false` |
| `description` | String | |
| `tags` | String[] | |
| `paper` | String | default `"А4"` |
| `isActive` | Boolean | default `true` |
| `docxData` | Bytes? | байти DOCX (не вибирати у списках) |
| `createdById` | String? | FK → User (set null) |
| `categoryId` | String? | FK → Category (set null) |
| `createdAt` / `updatedAt` | Timestamp | |

Індекси: `(categoryId, isActive)`, `(categorySlug, isActive)`, `(isActive, updatedAt)`,
`(categorySlug)`, `(createdById)`, `(popular)`.

### Personnel
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `lastName` / `firstName` | String | |
| `middleName` | String? | |
| `rank` / `position` | String | |
| `unit` | String? | |
| `status` | String | default `"в строю"` |
| `signaturePath` | String? | `/signature/<file>` |
| `createdAt` / `updatedAt` | Timestamp | |

Індекси: `(lastName, firstName)`, `(rank)`, `(status)`, `(unit)`.

### Course
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `label` | String | назва курсу |
| `fileName` | String | імпортований файл |
| `isActive` | Boolean | default `false` (один активний) |
| `createdAt` | Timestamp | |
| `records` | CourseRecord[] | 1:N |

Індекси: `(isActive)`.

### CourseRecord
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `courseId` | String | FK → Course (cascade) |
| `orderNumber` | Int? | № п/п |
| `lastName` / `firstName` / `middleName` | String? | |
| `fullName` | String? | як в Excel |
| `weaponNumber`, `rank`, `unitNumber`, `platoon`, `position`, `presence`, `sick`, `attentionGroup`, `statusDate`, `birthDate`, `birthPlace`, `conscribedBy`, `taxId`, `phone`, `relativesPhone`, `registrationAddress`, `residenceAddress`, `passport`, `education`, `drivingCategories`, `maritalStatus`, `workplace`, `distinctiveFeatures`, `debts`, `convictions`, `vlcConclusion`, `serviceExperience`, `combatExperience`, `bloodType`, `healthState`, `healthComplaints`, `allergies`, `injuries`, `militaryTicket`, `ubdNumber` | String? | 37 полів з Excel |
| `medicalReferrals` | MedicalReferral[] | 1:N |

Індекси: `(courseId)`, `(courseId, lastName, firstName)`, `(lastName, firstName)`.

### MedicalReferral
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `courseRecordId` | String | FK → CourseRecord (cascade) |
| `facility` | String? | медзаклад |
| `referralDate` | String? | дата направлення |
| `createdAt` / `updatedAt` | Timestamp | |

Індекси: `(courseRecordId)`.

### ExportedFile
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `userId` | String | FK → User (cascade) |
| `templateId` | String | FK → Template (restrict) |
| `title` / `fileName` | String | |
| `mimeType` | String | |
| `size` | Int | байтів |
| `data` | Bytes | байти DOCX (не вибирати у списках) |
| `createdAt` | Timestamp | |

Індекси: `(templateId)`, `(userId, createdAt)`.

### Image
| Поле | Тип | Примітки |
| --- | --- | --- |
| `id` | String | PK |
| `userId` | String | FK → User (cascade) |
| `filename` | String | UUID-ім'я на диску |
| `originalFilename` | String | оригінальна назва |
| `path` | String | `/uploads/users/{userId}/images/{file}` |
| `mimeType` / `size` / `width` / `height` | — | |
| `createdAt` | Timestamp | |

Індекси: `(userId, createdAt)`.

## DOCX-редактор

### Архітектура
```text
DocumentEditor (dynamic, ssr:false)
  └─ DocumentWorkspace (@docx-editor.dev Root, DOCX_MODULES)
       ├─ FieldNode + RepeatRowMarker + RepeatRowRegistry   (lib/docx-editor)
       ├─ FieldSelect / KeyboardLayoutShortcuts             (каретка/клавіші)
       ├─ DocumentRuntimeBridge → DocumentRuntime           (index + locator)
       ├─ PersonnelPanel / PersonnelPicker                  (прив'язка людей)
       ├─ FieldInsertDialog / FieldEditDialog / ImageInsertDialog
       ├─ TableRowDuplicate / RepeatRowAdmin
       └─ ExportButton                                      (збереження/експорт)
```

### Кастомні поля (`FieldNode`)
- Рушій: `@docx-editor.dev/pro`, «nodes without a payload» — чіп редагується прямо
  в документі (`preserveOnExport: "text"`).
- **Формат ключа:** `staff.{instance}.{field}` (персонал) або
  `cadet.{instance}.{field}` (курсанти), де `instance` ≥ 1, `field` — латиниця.
  Приклад: `staff.1.lastName`, `cadet.2.district`.
- У тезі (`acme:field`) фізично пишеться коротший `k=<key>` (ліміт `w:tag` — 64
  символи), а `p=<personnelId>` додається при прив'язці людини. Читання
  підтримує і legacy `key`.
- `fieldType` / `personInstance` виводяться зі схеми `key` при відкритті DOCX.
- Типи полів: персонал (`lastName`, `firstName`, `rank`, `position`, `signature`
  тощо) і курсанти (`COURSE_FIELD_LABELS`, `orderNumber` + 36 текстових).

### Повторення рядків таблиць
- `RepeatRowMarker` (тег `repeat:row`, атрибути `r`/`e`) позначає шаблонний рядок;
  `RepeatRowRegistry` (службовий вузол) зберігає означення повторів.
- Дублювання (`lib/docx-editor/table-row-duplicate.ts`): `insertRow` → копіювання
  вмісту комірок (`insertFragment`) → перезапис тегів `FieldNode` у клоні →
  вставка нового маркера. Модель і контролер розділені
  (`lib/...` vs `components/.../table-row-duplicate.tsx`).

### Плейсхолдери та Word
- `?word=1` на `/api/templates/[templateId]/docx` додає `<w:showingPlcHdr/>` до
  SDT з тегом — Word поводиться з ними як з плейсхолдерами. Редактор отримує
  сирий файл (інакше form-fill навігація ламається).

### Експорт і санітизація
- `lib/documents/sanitize-docx.ts`: розгортає content controls (прибирає SDT),
  гарантує Times New Roman у `docDefaults`; розміри тексту не змінює.
- `lib/documents/anchors.ts`: витягує позиції плаваючих зображень для коректного
  прев'ю `docx-preview` (він ігнорує `relativeFrom`).
- `lib/documents/docx-zip.ts`: безпечне розпакування DOCX із лімітом обсягу
  розпакування (захист від ZIP-bomb).

## Курси та Excel-імпорт

`lib/courses/types.ts` визначає 37 текстових полів і мапінг колонок Excel
(1-based) на поля запису; дати приймаються як серіальні числа Excel.

| Кол. | Поле | Тип |
| ---: | --- | --- |
| 1 | `orderNumber` | int |
| 2 | `weaponNumber` | text |
| 3 | `rank` | text |
| 4 | `fullName` | text |
| 5 | `unitNumber` | text |
| 6 | `platoon` | text |
| 7 | `position` | text |
| 8 | `presence` | text |
| 9 | `sick` | text |
| 10 | `attentionGroup` | text |
| 11 | `statusDate` | date |
| 12 | `birthDate` | date |
| 13 | `birthPlace` | text |
| 14 | `conscribedBy` | text |
| 15 | `taxId` | text |
| 16 | `phone` | text |
| 17 | `relativesPhone` | text |
| 18 | `registrationAddress` | text |
| 19 | `residenceAddress` | text |
| 20 | `passport` | text |
| 21 | `education` | text |
| 22 | `drivingCategories` | text |
| 23 | `maritalStatus` | text |
| 24 | `workplace` | text |
| 25 | `distinctiveFeatures` | text |
| 26 | `debts` | text |
| 27 | `convictions` | text |
| 28 | `vlcConclusion` | text |
| 29 | `serviceExperience` | text |
| 30 | `combatExperience` | text |
| 31 | `bloodType` | text |
| 32 | `healthState` | text |
| 33 | `healthComplaints` | text |
| 34 | `allergies` | text |
| 35 | `injuries` | text |
| 36 | `militaryTicket` | text |
| 37 | `ubdNumber` | text |

- Ліміт файлу — 15 МБ, приймається лише `.xlsx`. ПІБ розбирається
  (`splitFullName`) на прізвище/ім'я/по-батькові для пошуку й сортування.
- Людські назви полів — у `COURSE_FIELD_LABELS` (єдине джерело локалізації).

## Авторизація та безпека

- **Auth.js v5**, Credentials provider, JWT-сесія (`auth.ts`). Токен містить
  `id`, `username`, `role`, `isActive`.
- **Двошаровий захист:** рання перевірка в `proxy.ts` (`/admin` — лише ADMIN,
  `/profile` — будь-який авторизований) + серверна перевірка в
  `app/admin/layout.tsx` і хелперах `getSessionUser` / `getAdminId` /
  `requireAdminId` (перевіряють `isActive`).
- **Server actions** додатково перевіряють права (`getAdminId`), валідація — Zod.
- **Приватні аплоади:** підписи й зображення лежать у `storage/` (поза `public/`)
  і роздаються лише через `/signature/[file]` (авторизований) та
  `/uploads/[...path]` (власник або ADMIN). Каталог `storage/` у `.gitignore`.
- **PII:** довідник особового складу та курсантів передається в редактор лише
  авторизованому користувачу (`app/templates/[category]/[templateId]/page.tsx`).
- **Path traversal:** `removeSignatureFile`, `removeUploadedFile` та обидва
  файлові роути перевіряють `path.resolve` у межах свого кореня.
- **ZIP-bomb:** `loadDocxZip` відхиляє DOCX із надмірним обсягом розпакування
  (64 МБ/файл, 200 МБ сумарно, 2000 записів) → HTTP 413.
- Секрети — лише на сервері; `.env*` не комітяться; жодних `NEXT_PUBLIC_*`.

## Потоки даних

Створення шаблону:
```text
Admin → /admin/templates → createTemplateAction
  → validate (Zod) + getAdminId
  → readDocxFile (або generateBlankDocx)
  → orm.Template.create({ docxData })
  → revalidatePath → /admin/templates/[id]
```

Заповнення та експорт:
```text
User → /templates/[category]/[templateId]
  → load personnel/cadets (лише авторизованим) + docx через /api/templates/[id]/docx
  → DocumentEditor: заповнення полів, прив'язка, вставки
  → ExportButton → POST /api/exports (sanitize + save)
  → історія в /profile (GET /api/exports/[id] — download/preview)
```

Імпорт курсу:
```text
Admin → /admin/courses → importCourseAction
  → ExcelJS parse (≤15 МБ) → рядки CourseRecord
  → transaction: Course + records
  → activateCourseAction (один активний)
```

Живий пошук:
```text
Home → HomeSearch (debounce) → GET /api/templates/search?q=
  → searchTemplates: активні шаблони + категорії (без docxData), фільтр у пам'яті
```

## Обробка помилок

- **Server actions** повертають `{ ok: boolean; message: string }` (або
  `{ ok, message, field? }` для форм профілю). Технічні деталі — лише в серверних
  логах; UI отримує зрозумілі українські повідомлення.
- **API-роути** повертають JSON `{ message }` зі статусом (400/401/403/404/413).
- Валідація: Zod на сервері; клієнтські перевірки — лише для UX.
- `revalidatePath` оновлює списки після мутацій; на клієнті — `router.refresh()`.

## Продуктивність і кешування

- Списки/деталі не вибирають `docxData` / `ExportedFile.data` (явні `select`).
- Каталоги та довідники — на серверних компонентах; паралельні запити через
  `Promise.all`.
- Пагінація, пошук і сортування профілю — на рівні БД (offset/limit + ilike).
- Індекси під часті фільтри: `Template(isActive, updatedAt)`,
  `Template(categorySlug, isActive)`, `CourseRecord(courseId, lastName, firstName)`.
- `Cache-Control`: приватні аплоади — `private, immutable`; публічне прев'ю DOCX —
  `public, max-age=600`.

## Перевірки якості

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # Next.js production build
```

## Конвенції розробки

- Next.js App Router; за замовчуванням — Server Components, `"use client"` лише
  за потреби (стан/ефекти/браузерні API).
- Мутації — Server Actions; файлові віддачі та HTTP-специфіка — Route Handlers.
- Prisma-доступ лише на сервері й через доменні модулі в `lib/db/`.
- Типи спільні в `lib/*` (напр. `lib/names`, `lib/courses/types`), без дублювання.
- UI — українською; стиль адміністративний, компактний; shadcn/ui замість
  кастомних дублів.
- Документи — як структуровані дані, а не хардкод у компонентах.

## Відомі обмеження

- **Файлове сховище локальне.** Аплоади пишуться на диск сервера; на serverless
  (Vercel тощо) це не працюватиме без зовнішнього сховища (`UPLOADS_DIR`).
- **Історія git містить старі аплоади.** Файли прибрано з поточної версії та
  додано в `.gitignore`, але вони лишаються в історії комітів (за потреби —
  окрема очистка `git filter-repo`).
- **`docx-preview` на клієнті** розпаковує DOCX у браузері без серверного
  ZIP-ліміту (вміст — власний експорт або адмін-шаблон, ризик нижчий).
- **Підписи** читає будь-який авторизований користувач (потрібно для заповнення
  документів); за потреби можна звузити до ADMIN із окремим каналом для редактора.
- **Аплоади перевіряються за MIME з клієнта** (без перевірки сигнатури файлу).

## FAQ / Troubleshooting

**Помилка БД / «DB error» при логіні.**
Перевірте `DATABASE_URL` і що схема підготовлена: `npm run contract:emit` →
`npx prisma db init` (або `db update`) → `npx prisma db verify`.

**`AUTH_SECRET is not set`.**
Згенеруйте секрет (`npx auth secret`) і додайте в `.env.local`.

**Редактор не завантажується / помилка парсингу DOCX.**
Редактор працює лише в браузері (динамічний імпорт, `ssr:false`). Перевірте, що
шаблон має валідний DOCX (`docxData`) і не перевищує ліміт розпакування.

**Аплоади 404 після запуску.**
Файли мають лежати в `storage/` (або `UPLOADS_DIR`). Старі файли, перенесені з
`public/`, уже в `storage/`. Перезапуск не потрібен — роути читають з диска.

**`migration plan` падає з `AMBIGUOUS_TARGET`.**
Розбіг історії міграцій. Перевірте `npx prisma migration graph`; на диску має
бути один лінійний ланцюг до голови `db`-рефа.

---

# Helper (English)

A web application for creating and managing military documentation: document
templates, personnel records, cadet courses, a media library and exports. The UI
and generated documents are in Ukrainian.

- **Purpose:** speed up routine military paperwork — fill a few fields in a ready
  template instead of formatting by hand.
- **Audience:** personnel and staffing services.
- **Approach:** structured data (DB contract + schemas), business logic separated
  from UI, all authorization performed server-side.

## Table of contents

1. [Features](#features)
2. [Roles and permissions](#roles-and-permissions)
3. [Stack](#stack)
4. [Requirements](#requirements)
5. [Quick start](#quick-start)
6. [Environment variables](#environment-variables)
7. [Scripts](#scripts)
8. [Project structure](#project-structure)
9. [Pages](#pages)
10. [API](#api-1)
11. [Database and migrations](#database-and-migrations)
12. [Data models](#data-models)
13. [DOCX editor](#docx-editor)
14. [Courses and Excel import](#courses-and-excel-import)
15. [Authentication and security](#authentication-and-security)
16. [Data flows](#data-flows)
17. [Error handling](#error-handling)
18. [Performance and caching](#performance-and-caching)
19. [Quality checks](#quality-checks)
20. [Development conventions](#development-conventions)
21. [Known limitations](#known-limitations)
22. [FAQ / Troubleshooting](#faq--troubleshooting-1)

## Features

### Template catalog
- Categories with description, ordering and visibility; templates with tags,
  paper size (A4 / A4 landscape) and a "popular" flag.
- Live search across the catalog (`/api/templates/search`) on the home page.
- Fallback: if the DB is unavailable or empty, a static catalog
  (`lib/documents/catalog.ts`) is used.

### DOCX editor
- Embedded `docx-editor.dev` (Word-like) with menus, toolbar and preview.
- Custom placeholder fields (Content Controls) for personnel and cadets, binding
  specific people, and repeating table rows.
- Insert images (upload or library) and personnel signatures.
- Save the template and export the filled document as DOCX.

### Personnel
- Roster of document signers: full name, rank, position, status and signature
  (PNG/JPEG, up to 2 MB).

### Cadet courses
- Import a list from Excel (`.xlsx`, up to 15 MB), edit 37 record fields, multiple
  referrals per cadet, one active course for the site.

### Exports and media library
- User export history with search, sorting, pagination, rename and delete.
- User image library (JPG/PNG/GIF/WEBP, up to 10 MB).

### Profile and admin panel
- Profile: change login/password, full name and rank.
- Admin panel: users, categories, templates, personnel, courses.

## Roles and permissions

| Resource / action | Anonymous | `USER` | `ADMIN` |
| --- | :---: | :---: | :---: |
| Home `/`, catalog `/templates`, `/search` | ✅ | ✅ | ✅ |
| View template `/templates/[category]/[templateId]` | ✅ (no PII) | ✅ (with PII) | ✅ |
| Edit document + export to own history | ❌ | ✅ | ✅ |
| Profile `/profile` | ❌ | ✅ | ✅ |
| Read signatures `/signature/[file]` | ❌ | ✅ | ✅ |
| Read own images `/uploads/...` | ❌ | ✅ (own) | ✅ (all) |
| Admin panel `/admin/**` | ❌ | ❌ | ✅ |
| Manage templates/categories/personnel/courses | ❌ | ❌ | ✅ |
| Upload signatures `/api/signature/upload` | ❌ | ❌ | ✅ |

## Stack

| Layer | Technologies |
| --- | --- |
| Framework | Next.js 16.2.6 (App Router, Turbopack, Server Components/Actions) |
| UI | React 19.2.4, Tailwind CSS 4, shadcn/ui (`base-nova` style, Base UI), lucide-react, sonner |
| Language | TypeScript 5 (strict), Zod 4 |
| Data | Prisma Next 8 (`@prisma/orm-postgres`, contract-first), PostgreSQL |
| Auth | Auth.js / NextAuth 5 (Credentials, JWT), bcrypt |
| Documents | docx-editor.dev 2.16, docx-preview, JSZip, exceljs |

## Requirements

- **Node.js 20+**
- **PostgreSQL 15+**
- **npm**

## Quick start

```bash
# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env.local   # set DATABASE_URL and AUTH_SECRET

# 3. Contract + DB schema
npm run contract:emit
npx prisma db init           # first run (bootstrap + sign)
# after later contract changes: npx prisma db update

# 4. Users (the seed creates accounts only)
npm run db:seed

# 5. Dev server
npm run dev                  # http://localhost:3000
```

Users after seeding (no demo categories, personnel or templates are created):

| Login | Password | Role |
| --- | --- | --- |
| `admin` | `Admin123!` (or `ADMIN_PASSWORD`) | `ADMIN` |
| `user` | `User123!` (or `USER_PASSWORD`) | `USER` |
| `kovalchuk` | `Koval123!` | `USER` |

## Environment variables

| Variable | Required | Purpose |
| --- | :---: | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | ➖ | Direct connection (Vercel / Prisma Postgres) |
| `AUTH_SECRET` | ✅ | NextAuth secret (`npx auth secret` / `openssl rand -hex 32`) |
| `AUTH_TRUST_HOST` | ➖ | Trust host behind a proxy (enabled in `auth.ts`) |
| `ADMIN_PASSWORD` | ➖ | Admin password for `db:seed` |
| `USER_PASSWORD` | ➖ | Demo user password for `db:seed` |
| `UPLOADS_DIR` | ➖ | Private uploads directory (default `<cwd>/storage`) |

## Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Type checking (`tsc --noEmit`) |
| `npm run format` | Prettier formatting |
| `npm run contract:emit` | Regenerate `contract.json` / `contract.d.ts` |
| `npm run db:seed` | Create users (admin, user, kovalchuk) |

## Project structure

```text
app/
  layout.tsx                      root layout (fonts, providers, Toaster)
  page.tsx                        home (hero, features, catalog, CTA)
  admin/
    layout.tsx                    server-side ADMIN check + shared chrome
    page.tsx                      overview (counters)
    users|personnel|categories|courses|templates/  admin sections
    templates/[templateId]/       template editor
  templates/
    page.tsx                      category catalog
    [category]/page.tsx           templates in a category
    [category]/[templateId]/      view / fill a document
  profile/
    page.tsx                      profile (documents, media)
    actions.ts                    profile server actions
  search/page.tsx                 catalog search
  forbidden|unauthorized/         403/401 pages
  api/
    auth/[...nextauth]/route.ts   Auth.js handlers
    exports/route.ts              POST: save an export
    exports/[id]/route.ts         GET: download/preview; ?anchors=1, ?inline=1
    images/route.ts               GET: user image library
    images/upload/route.ts        POST: upload an image
    signature/upload/route.ts     POST: upload a signature (ADMIN)
    templates/[templateId]/docx/route.ts        GET: template DOCX; ?word=1
    templates/[templateId]/docx-preview/route.ts GET: public DOCX preview
    templates/search/route.ts     GET: template search
    admin/templates/[templateId]/docx/route.ts  GET: DOCX for admin editor
  uploads/[...path]/route.ts      GET: private image serving (auth)
  signature/[file]/route.ts       GET: private signature serving (auth)
components/
  ui/                             shadcn/ui base components
  shared/                         EmptyState, ConfirmDelete, FormStatus, SubmitButton
  site-header|site-footer|theme-* shared shell
  auth/                           auth-modal, auth-provider, user-menu
  admin/                          admin section managers
  profile/                        profile: lists, forms, media, pagination
  templates/                      catalog: cards, search, filter
  site/preview-doc.tsx            DOCX preview via docx-preview
  documents/docx-editor/          DOCX editor (engine integrations)
lib/
  db.ts                           re-export db/orm/nowTimestamp
  db/                             per-domain queries (exports, images, templates)
  auth.ts                         getSessionUser / getAdminId / requireAdminId
  validation.ts                   login/password rules, SALT_ROUNDS
  names/index.ts                  getFullName / getInitials
  format.ts                       formatBytes / formatDateTime
  storage/paths.ts                private upload directories
  documents/                      filename, sanitize-docx, anchors, docx-zip
  docx-editor/                    field-node, repeat-row, table-row-duplicate, uk
  templates|courses|personnel|categories|users/  domain modules
  profile/query.ts                buildProfileHref
src/prisma/
  contract.prisma                 schema source of truth
  contract.json / contract.d.ts   generated (do not edit manually)
  db.ts                           postgres<Contract>(...), orm
  seed.ts                         seed
migrations/
  app/<timestamp>_<name>/         versioned migrations
  snapshots/<hash>/               contract snapshots (referenced by migrations)
  app/refs/db.json                ref to the current DB state
auth.ts                           NextAuth configuration
proxy.ts                          middleware (guards /admin, /profile)
prisma.config.ts                  Prisma CLI configuration
next.config.ts                    Next.js configuration
```

## Pages

| Path | Access | Purpose |
| --- | --- | --- |
| `/` | public | Home: overview, features, catalog, preview |
| `/templates` | public | Category catalog |
| `/templates/[category]` | public | Templates in one category |
| `/templates/[category]/[templateId]` | public | Editor/fill (PII only for authenticated) |
| `/search` | public | Catalog search |
| `/profile` | authenticated | Profile, documents, media |
| `/admin` | `ADMIN` | Admin overview |
| `/admin/users` | `ADMIN` | Users |
| `/admin/personnel` | `ADMIN` | Personnel and signatures |
| `/admin/categories` | `ADMIN` | Categories |
| `/admin/courses` | `ADMIN` | Courses and cadet records |
| `/admin/templates` | `ADMIN` | Templates |
| `/admin/templates/[templateId]` | `ADMIN` | Template editor |
| `/forbidden` | public | 403 |
| `/unauthorized` | public | 401 |

## API

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/exports` | authenticated | Save a filled DOCX to history. `FormData: templateId, title, file` |
| `GET` | `/api/exports/[id]` | owner/ADMIN | Download (`attachment`) or preview (`?inline=1`); `?anchors=1` — floating image positions |
| `GET` | `/api/images` | authenticated | List own images. `?q&page&pageSize` |
| `POST` | `/api/images/upload` | authenticated | Upload an image. `FormData: file` |
| `POST` | `/api/signature/upload` | `ADMIN` | Upload a signature. `FormData: file` |
| `GET` | `/api/templates/[templateId]/docx` | authenticated | Active template DOCX; `?word=1` adds placeholders |
| `GET` | `/api/templates/[templateId]/docx-preview` | public | DOCX bytes for preview (10-min cache) |
| `GET` | `/api/templates/search` | public | Template search. `?q&limit` (≤20) |
| `GET` | `/api/admin/templates/[templateId]/docx` | `ADMIN` | DOCX for the admin editor (regardless of `isActive`) |
| `GET` | `/uploads/[...path]` | authenticated | Private image serving (`storage/uploads`) |
| `GET` | `/signature/[file]` | authenticated | Private signature serving (`storage/signature`) |
| `GET/POST` | `/api/auth/[...nextauth]` | — | Auth.js handlers |

Examples:

```bash
# Template search
curl "http://localhost:3000/api/templates/search?q=report&limit=5"

# Download an export (session/cookie required)
curl -O -b cookies.txt "http://localhost:3000/api/exports/<id>?inline=1"
```

## Database and migrations

The project uses **Prisma Next (contract-first)**: the source of truth is
`src/prisma/contract.prisma`. The working artifacts `contract.json` and
`contract.d.ts` are generated by `npm run contract:emit` and must not be edited
by hand.

Schema change workflow:

```bash
# 1) Edit contract.prisma
# 2) Regenerate the contract
npm run contract:emit

# 3) Plan a migration (offline, does not touch the DB)
npx prisma migration plan --name <name>

# 4) Apply to the database
npx prisma db migrate

# 5) Verify consistency
npx prisma db verify
npx prisma migration check
```

Inspection commands: `npx prisma migration status`, `npx prisma migration graph`,
`npx prisma migration log`. The current DB state ref is
`migrations/app/refs/db.json`.

> Current migration chain (linear):
> `baseline → add_courses → drop_template_fields → add_medical_referral → add_lookup_indexes`.

## Data models

`enum Role { ADMIN, USER }`. All `id` fields are `String` generated with
`nanoid()`; timestamp fields are `TimestampString(3)` (default `now()`).

### Category
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `slug` | String | unique |
| `title` | String | |
| `description` | String | |
| `longDescription` | String? | |
| `icon` | String? | |
| `countLabel` | String | default `"шаблонів"` |
| `sortOrder` | Int | default `0` |
| `isActive` | Boolean | default `true` |
| `createdAt` / `updatedAt` | Timestamp | |
| `templates` | Template[] | 1:N |

Indexes: `(isActive, sortOrder)`.

### User
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `username` | String | unique |
| `password` | String | bcrypt |
| `role` | Role | default `USER` |
| `isActive` | Boolean | default `true` |
| `createdAt` / `updatedAt` | Timestamp | |
| `profile` | Profile? | 1:1 |
| `templates`, `exportedFiles`, `images` | — | 1:N |

Indexes: `(role)`.

### Profile
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `userId` | String | unique, FK → User (cascade) |
| `lastName` / `firstName` / `middleName` | String? | |
| `rank` | String? | |
| `createdAt` / `updatedAt` | Timestamp | |

### Template
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `categorySlug` | String | |
| `title` | String | |
| `fields` | Int | field count (metric) |
| `popular` | Boolean | default `false` |
| `description` | String | |
| `tags` | String[] | |
| `paper` | String | default `"А4"` |
| `isActive` | Boolean | default `true` |
| `docxData` | Bytes? | DOCX bytes (do not select in lists) |
| `createdById` | String? | FK → User (set null) |
| `categoryId` | String? | FK → Category (set null) |
| `createdAt` / `updatedAt` | Timestamp | |

Indexes: `(categoryId, isActive)`, `(categorySlug, isActive)`, `(isActive, updatedAt)`,
`(categorySlug)`, `(createdById)`, `(popular)`.

### Personnel
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `lastName` / `firstName` | String | |
| `middleName` | String? | |
| `rank` / `position` | String | |
| `unit` | String? | |
| `status` | String | default `"в строю"` |
| `signaturePath` | String? | `/signature/<file>` |
| `createdAt` / `updatedAt` | Timestamp | |

Indexes: `(lastName, firstName)`, `(rank)`, `(status)`, `(unit)`.

### Course
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `label` | String | course name |
| `fileName` | String | imported file |
| `isActive` | Boolean | default `false` (one active) |
| `createdAt` | Timestamp | |
| `records` | CourseRecord[] | 1:N |

Indexes: `(isActive)`.

### CourseRecord
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `courseId` | String | FK → Course (cascade) |
| `orderNumber` | Int? | row number |
| `lastName` / `firstName` / `middleName` | String? | |
| `fullName` | String? | as in Excel |
| `weaponNumber`, `rank`, `unitNumber`, `platoon`, `position`, `presence`, `sick`, `attentionGroup`, `statusDate`, `birthDate`, `birthPlace`, `conscribedBy`, `taxId`, `phone`, `relativesPhone`, `registrationAddress`, `residenceAddress`, `passport`, `education`, `drivingCategories`, `maritalStatus`, `workplace`, `distinctiveFeatures`, `debts`, `convictions`, `vlcConclusion`, `serviceExperience`, `combatExperience`, `bloodType`, `healthState`, `healthComplaints`, `allergies`, `injuries`, `militaryTicket`, `ubdNumber` | String? | 37 Excel fields |
| `medicalReferrals` | MedicalReferral[] | 1:N |

Indexes: `(courseId)`, `(courseId, lastName, firstName)`, `(lastName, firstName)`.

### MedicalReferral
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `courseRecordId` | String | FK → CourseRecord (cascade) |
| `facility` | String? | medical facility |
| `referralDate` | String? | referral date |
| `createdAt` / `updatedAt` | Timestamp | |

Indexes: `(courseRecordId)`.

### ExportedFile
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `userId` | String | FK → User (cascade) |
| `templateId` | String | FK → Template (restrict) |
| `title` / `fileName` | String | |
| `mimeType` | String | |
| `size` | Int | bytes |
| `data` | Bytes | DOCX bytes (do not select in lists) |
| `createdAt` | Timestamp | |

Indexes: `(templateId)`, `(userId, createdAt)`.

### Image
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String | PK |
| `userId` | String | FK → User (cascade) |
| `filename` | String | UUID name on disk |
| `originalFilename` | String | original name |
| `path` | String | `/uploads/users/{userId}/images/{file}` |
| `mimeType` / `size` / `width` / `height` | — | |
| `createdAt` | Timestamp | |

Indexes: `(userId, createdAt)`.

## DOCX editor

### Architecture
```text
DocumentEditor (dynamic, ssr:false)
  └─ DocumentWorkspace (@docx-editor.dev Root, DOCX_MODULES)
       ├─ FieldNode + RepeatRowMarker + RepeatRowRegistry   (lib/docx-editor)
       ├─ FieldSelect / KeyboardLayoutShortcuts             (caret/keys)
       ├─ DocumentRuntimeBridge → DocumentRuntime           (index + locator)
       ├─ PersonnelPanel / PersonnelPicker                  (binding people)
       ├─ FieldInsertDialog / FieldEditDialog / ImageInsertDialog
       ├─ TableRowDuplicate / RepeatRowAdmin
       └─ ExportButton                                      (save/export)
```

### Custom fields (`FieldNode`)
- Engine: `@docx-editor.dev/pro`, "nodes without a payload" — the chip is edited
  directly in the document (`preserveOnExport: "text"`).
- **Key format:** `staff.{instance}.{field}` (personnel) or
  `cadet.{instance}.{field}` (cadets), where `instance` ≥ 1 and `field` is
  alphanumeric. Example: `staff.1.lastName`, `cadet.2.district`.
- In the tag (`acme:field`) the shorter `k=<key>` is physically written (the
  `w:tag` limit is 64 chars), and `p=<personnelId>` is added when a person is
  bound. Reading also accepts the legacy `key`.
- `fieldType` / `personInstance` are derived from the `key` schema when a DOCX is
  opened.
- Field types: personnel (`lastName`, `firstName`, `rank`, `position`,
  `signature`, etc.) and cadets (`COURSE_FIELD_LABELS`, `orderNumber` + 36 text
  fields).

### Repeating table rows
- `RepeatRowMarker` (tag `repeat:row`, attributes `r`/`e`) marks the template row;
  `RepeatRowRegistry` (service node) stores repeat definitions.
- Duplication (`lib/docx-editor/table-row-duplicate.ts`): `insertRow` → copy cell
  content (`insertFragment`) → rewrite `FieldNode` tags in the clone → insert a
  new marker. The model and controller are separated
  (`lib/...` vs `components/.../table-row-duplicate.tsx`).

### Placeholders and Word
- `?word=1` on `/api/templates/[templateId]/docx` adds `<w:showingPlcHdr/>` to
  tagged SDTs, so Word treats them as placeholders. The editor receives the raw
  file (otherwise form-fill navigation breaks).

### Export and sanitization
- `lib/documents/sanitize-docx.ts`: unwraps content controls (removes SDTs) and
  enforces Times New Roman in `docDefaults`; text sizes are left unchanged.
- `lib/documents/anchors.ts`: extracts floating image positions for correct
  `docx-preview` rendering (it ignores `relativeFrom`).
- `lib/documents/docx-zip.ts`: safe DOCX unpacking with a decompression size limit
  (ZIP-bomb protection).

## Courses and Excel import

`lib/courses/types.ts` defines 37 text fields and the Excel column (1-based) to
record field mapping; dates are accepted as Excel serial numbers.

| Col. | Field | Type |
| ---: | --- | --- |
| 1 | `orderNumber` | int |
| 2 | `weaponNumber` | text |
| 3 | `rank` | text |
| 4 | `fullName` | text |
| 5 | `unitNumber` | text |
| 6 | `platoon` | text |
| 7 | `position` | text |
| 8 | `presence` | text |
| 9 | `sick` | text |
| 10 | `attentionGroup` | text |
| 11 | `statusDate` | date |
| 12 | `birthDate` | date |
| 13 | `birthPlace` | text |
| 14 | `conscribedBy` | text |
| 15 | `taxId` | text |
| 16 | `phone` | text |
| 17 | `relativesPhone` | text |
| 18 | `registrationAddress` | text |
| 19 | `residenceAddress` | text |
| 20 | `passport` | text |
| 21 | `education` | text |
| 22 | `drivingCategories` | text |
| 23 | `maritalStatus` | text |
| 24 | `workplace` | text |
| 25 | `distinctiveFeatures` | text |
| 26 | `debts` | text |
| 27 | `convictions` | text |
| 28 | `vlcConclusion` | text |
| 29 | `serviceExperience` | text |
| 30 | `combatExperience` | text |
| 31 | `bloodType` | text |
| 32 | `healthState` | text |
| 33 | `healthComplaints` | text |
| 34 | `allergies` | text |
| 35 | `injuries` | text |
| 36 | `militaryTicket` | text |
| 37 | `ubdNumber` | text |

- File limit is 15 MB, only `.xlsx` is accepted. Full names are split
  (`splitFullName`) into last/first/middle name for search and sorting.
- Human-readable field labels live in `COURSE_FIELD_LABELS` (single localization
  source).

## Authentication and security

- **Auth.js v5**, Credentials provider, JWT session (`auth.ts`). The token carries
  `id`, `username`, `role`, `isActive`.
- **Two-layer protection:** early checks in `proxy.ts` (`/admin` — ADMIN only,
  `/profile` — any authenticated user) plus server-side checks in
  `app/admin/layout.tsx` and the `getSessionUser` / `getAdminId` /
  `requireAdminId` helpers (they verify `isActive`).
- **Server actions** additionally check permissions (`getAdminId`); validation is
  done with Zod.
- **Private uploads:** signatures and images live in `storage/` (outside
  `public/`) and are served only through `/signature/[file]` (authenticated) and
  `/uploads/[...path]` (owner or ADMIN). `storage/` is in `.gitignore`.
- **PII:** the personnel and cadet directories are passed to the editor only for an
  authenticated user (`app/templates/[category]/[templateId]/page.tsx`).
- **Path traversal:** `removeSignatureFile`, `removeUploadedFile` and both file
  routes verify `path.resolve` stays within their root.
- **ZIP-bomb:** `loadDocxZip` rejects DOCX files with excessive decompressed size
  (64 MB per file, 200 MB total, 2000 entries) → HTTP 413.
- Secrets stay server-side; `.env*` is never committed; no `NEXT_PUBLIC_*`.

## Data flows

Creating a template:
```text
Admin → /admin/templates → createTemplateAction
  → validate (Zod) + getAdminId
  → readDocxFile (or generateBlankDocx)
  → orm.Template.create({ docxData })
  → revalidatePath → /admin/templates/[id]
```

Filling and exporting:
```text
User → /templates/[category]/[templateId]
  → load personnel/cadets (authenticated only) + docx via /api/templates/[id]/docx
  → DocumentEditor: fill fields, bind, insert
  → ExportButton → POST /api/exports (sanitize + save)
  → history in /profile (GET /api/exports/[id] — download/preview)
```

Importing a course:
```text
Admin → /admin/courses → importCourseAction
  → ExcelJS parse (≤15 MB) → CourseRecord rows
  → transaction: Course + records
  → activateCourseAction (one active)
```

Live search:
```text
Home → HomeSearch (debounce) → GET /api/templates/search?q=
  → searchTemplates: active templates + categories (no docxData), filter in memory
```

## Error handling

- **Server actions** return `{ ok: boolean; message: string }` (or
  `{ ok, message, field? }` for profile forms). Technical details stay in server
  logs; the UI receives clear Ukrainian messages.
- **API routes** return JSON `{ message }` with a status (400/401/403/404/413).
- Validation: Zod on the server; client checks are UX-only.
- `revalidatePath` refreshes lists after mutations; on the client — `router.refresh()`.

## Performance and caching

- Lists/details never select `docxData` / `ExportedFile.data` (explicit `select`).
- Catalogs and directories are server-rendered; independent queries run in
  parallel via `Promise.all`.
- Profile pagination, search and sorting happen at the DB level (offset/limit +
  ilike).
- Indexes for frequent filters: `Template(isActive, updatedAt)`,
  `Template(categorySlug, isActive)`, `CourseRecord(courseId, lastName, firstName)`.
- `Cache-Control`: private uploads — `private, immutable`; public DOCX preview —
  `public, max-age=600`.

## Quality checks

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # Next.js production build
```

## Development conventions

- Next.js App Router; Server Components by default, `"use client"` only when
  needed (state/effects/browser APIs).
- Mutations use Server Actions; file serving and HTTP-specific logic use Route
  Handlers.
- Prisma access is server-only and goes through domain modules in `lib/db/`.
- Shared types live in `lib/*` (e.g. `lib/names`, `lib/courses/types`) without
  duplication.
- UI is in Ukrainian; the style is administrative and compact; shadcn/ui is used
  instead of custom duplicates.
- Documents are treated as structured data, not hardcoded in components.

## Known limitations

- **Local file storage.** Uploads are written to the server disk; this does not
  work on serverless (Vercel, etc.) without external storage (`UPLOADS_DIR`).
- **Git history contains old uploads.** Files were removed from the current
  version and added to `.gitignore`, but they remain in commit history (a separate
  `git filter-repo` cleanup is required if needed).
- **Client-side `docx-preview`** unpacks DOCX in the browser without the
  server-side ZIP limit (content is an own export or an admin template, so the
  risk is lower).
- **Signatures** are readable by any authenticated user (needed to fill documents);
  this can be narrowed to ADMIN with a dedicated editor channel if required.
- **Uploads are validated by client-provided MIME** (no file signature sniffing).

## FAQ / Troubleshooting

**DB error / "DB error" on login.**
Check `DATABASE_URL` and that the schema is prepared: `npm run contract:emit` →
`npx prisma db init` (or `db update`) → `npx prisma db verify`.

**`AUTH_SECRET is not set`.**
Generate a secret (`npx auth secret`) and add it to `.env.local`.

**The editor does not load / DOCX parse error.**
The editor runs in the browser only (dynamic import, `ssr:false`). Ensure the
template has a valid DOCX (`docxData`) and does not exceed the decompression
limit.

**Uploads return 404 after startup.**
Files must live in `storage/` (or `UPLOADS_DIR`). Files migrated from `public/`
are already in `storage/`. No restart is needed — routes read from disk.

**`migration plan` fails with `AMBIGUOUS_TARGET`.**
Migration history divergence. Check `npx prisma migration graph`; there must be a
single linear chain to the `db` ref head.
