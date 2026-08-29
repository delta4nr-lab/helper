<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md

## Project

This project is a web application for simplifying the creation and management
of military documentation.

The application should help users:

* Create documents from structured forms and templates.
* Reuse personnel and reference data.
* Validate document data.
* Preview documents before export.
* Export documents to Excel, PDF, and Word.
* Search, filter, and manage personnel and documents.

Primary language of the UI and generated documents: Ukrainian.

---

## Stack

* Next.js (App Router)
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Radix UI
* Lucide React
* Prisma
* PostgreSQL
* React Hook Form
* Zod

Preferred document libraries:

* Excel: `exceljs`
* Word: `docx`
* PDF: choose the most suitable server-side solution already used by the project

Do not introduce another library when the existing stack already solves the problem.

---

## Core Principles

1. Correctness and data integrity come first.
2. Keep implementation simple and maintainable.
3. Reuse existing project components and utilities.
4. Do not rewrite working code without a clear reason.
5. Avoid unnecessary dependencies and abstractions.
6. Keep business logic separate from UI.
7. Validate all important input on the server.
8. Never expose sensitive data or secrets to the client.

---

## Next.js

Use the App Router.

Prefer Server Components by default.

Use `"use client"` only when required for:

* React state
* effects
* browser APIs
* event handlers
* client-only libraries

Prefer:

```text
Server Component
    ↓
Server-side data fetching
    ↓
Client Component only where interactivity is required
```

Use Server Actions for mutations when appropriate.

Use Route Handlers for:

* file downloads
* external integrations
* HTTP-specific functionality
* streaming

---

## TypeScript

Use strict TypeScript.

Avoid `any`.

Prefer explicit types and reusable interfaces/types.

Do not silently suppress TypeScript errors.

Keep shared types in reusable modules instead of duplicating them.

---

## Prisma / Database

All database access must happen on the server.

Use Prisma for PostgreSQL access.

Keep complex database operations outside React components.

Prefer reusable database functions:

```text
lib/
  db/
    documents.ts
    personnel.ts
    templates.ts
```

Use database indexes for frequently searched or filtered fields.

Do not store important structured data as unstructured JSON unless the
structure is genuinely dynamic.

---

## Validation

Use Zod for validation.

Use React Hook Form for complex forms.

Validate twice when necessary:

```text
Client validation
      ↓
Server validation
      ↓
Database
```

Never trust values received from the browser.

---

## Military Documents

Documents should be treated as structured data, not as large hardcoded
React components.

Prefer this architecture:

```text
Document Data
     ↓
Document Schema
     ↓
Template
     ↓
Renderer
     ↓
Preview / Export
```

Templates should be reusable.

Adding a new document type should not require rewriting the entire editor.

Keep document-specific logic inside dedicated modules.

Example:

```text
lib/
  documents/
    templates/
    renderers/
```

---

## Personnel Data

Treat personnel information as structured data.

Prefer separate fields where practical:

```ts
type PersonName = {
  lastName: string;
  firstName: string;
  middleName?: string;
};
```

Do not duplicate name formatting or declension logic across components.

Keep reusable logic in:

```text
lib/names/
```

Dates should be stored as proper date values and formatted only for display
or export.

---

## Export

Export logic must be independent from UI components.

Preferred structure:

```text
lib/
  export/
    excel/
    word/
    pdf/
```

Conceptually:

```text
Document Data
     ↓
Exporter
     ↓
File
```

Exports must preserve:

* document structure
* formatting
* dates
* tables
* signatures
* page settings where applicable

Use meaningful filenames.

Do not generate files by screenshotting the browser unless there is no
practical alternative.

---

## UI

Use shadcn/ui whenever an appropriate component exists.

Prefer:

* Button
* Input
* Select
* Combobox
* Dialog
* Sheet
* Tabs
* Accordion
* Table
* Command
* Calendar
* Popover
* AlertDialog
* Tooltip

Do not create duplicate custom components when shadcn/ui already provides
the required functionality.

The interface should feel like a professional administrative application:
clear, compact, consistent, and information-dense.

Avoid unnecessary:

* gradients
* animations
* decorative elements
* excessive cards
* excessive whitespace

---

## Forms and Tables

Complex forms should be divided into logical sections.

Use tabs, accordions, steps, or collapsible sections when appropriate.

Large tables should support where useful:

* search
* filtering
* sorting
* pagination
* column visibility
* row selection

Prefer server-side filtering and pagination for large datasets.

---

## Performance

Optimize for older computers and modest servers.

Prefer:

* Server Components
* server-side filtering
* pagination
* caching for reference data
* lazy loading
* dynamic imports for heavy client libraries

Do not send large document-generation libraries to the browser unnecessarily.

Avoid loading entire large datasets into client memory.

---

## Security

Treat military and personnel data as sensitive.

Never expose:

* secrets
* database credentials
* server-only environment variables
* stack traces
* internal database errors

Do not place secrets in `NEXT_PUBLIC_*`.

Every sensitive server operation must verify authentication and authorization.

UI restrictions are not a substitute for server-side authorization.

Avoid logging sensitive personnel information.

---

## Localization

Use Ukrainian for user-facing text.

Do not scatter hardcoded UI strings throughout large components when they
should be shared or localized.

Keep terminology consistent across:

* forms
* tables
* notifications
* document templates
* export filenames

---

## Component Structure

Prefer small, focused components.

Example:

```text
components/
  ui/
  shared/
  documents/
  personnel/
  export/
```

Avoid huge components containing database logic, forms, business logic,
preview logic, and export logic in one file.

Extract reusable logic into:

* hooks
* utilities
* services
* server actions

---

## Error Handling

User-facing errors must be understandable.

Bad:

```text
PrismaClientKnownRequestError
```

Good:

```text
Не вдалося зберегти документ.
Спробуйте ще раз.
```

Keep technical details in server logs, not in the UI.

---

## Code Changes

Before changing code:

1. Inspect the existing implementation.
2. Search for existing related components/utilities.
3. Check database models and existing patterns.
4. Reuse existing functionality whenever possible.

Make the smallest reasonable change.

Do not rename or remove existing APIs, fields, or components without checking
their usages.

Do not introduce a new architecture for a small feature.

---

## Dependencies

Before adding a package, check whether the project already has a suitable
solution.

Every new dependency must have a clear benefit.

Do not add packages only for convenience when native Next.js, React,
TypeScript, Prisma, or shadcn/ui can solve the problem.

---

## Quality Checks

Before finishing a significant task, run:

```bash
npm run lint
```

```bash
npm run typecheck
```

For significant changes also run:

```bash
npm run build
```

Fix errors introduced by the implementation before considering the task
complete.

---

## Git

Use clear commit messages such as:

```text
feat: add document template editor
fix: correct Excel export formatting
refactor: extract document renderer
perf: optimize personnel search
ui: improve document editor
```

Never commit:

* `.env`
* secrets
* generated temporary files
* private exported documents
* credentials

---

## Agent Behavior

When implementing a task:

* Follow the existing project architecture.
* Prefer simple solutions.
* Reuse existing components.
* Keep server and client responsibilities clear.
* Preserve existing functionality.
* Consider export requirements early when building document features.
* Keep sensitive data server-side.
* Explain important assumptions briefly.
* Do not overengineer.

The final implementation should be production-oriented, typed, reusable,
maintainable, and consistent with the existing codebase.

<!-- END:nextjs-agent-rules -->
