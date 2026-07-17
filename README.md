# Atria Wellness Patient Intake Platform

A multi-tenant healthcare SaaS platform that automates patient intake — from
appointment booking through a secure online intake portal, validation,
staff review, and a ready-to-upload document package. V1 serves Atria
Wellness; the architecture is built to onboard additional clinics without
code changes and to grow with future modules (scheduling, billing,
telemedicine, secure messaging, etc.) over time.

## Why the last step is manual

Atria Wellness's EHR is **Jane App**, which has no document-upload API.
Every step of this platform automates the intake process right up until
the point paperwork needs to land in the patient's Jane record — that
final upload is a manual action performed by clinic staff, by design, not
an oversight.

The seam for this is `JaneExportAdapter`
([apps/api/src/providers/jane-export/jane-export.adapter.ts](apps/api/src/providers/jane-export/jane-export.adapter.ts)):

- `prepareExportPackage(intakeId)` builds and returns a signed download URL
  for the complete document package (registration, medical history, signed
  consents, HIPAA ack, insurance card images, ID, prior records, AI
  summary).
- `confirmManualUpload(intakeId, userId)` is called from the staff
  dashboard's "mark uploaded to Jane" checklist action, after staff have
  manually uploaded that package into Jane. It timestamps
  `intakes.uploadedToJaneAt` and writes an audit log entry.

If Jane ever ships a document-upload API, only this adapter changes — swap
`confirmManualUpload` for a real `uploadToJane()` call. No other module
(Intake, Documents, Dashboard) needs to change.

## Monorepo layout

```
apps/
  web/      Next.js 15 (App Router) — staff dashboard + patient intake portal
  api/      NestJS — REST API, Prisma/PostgreSQL, BullMQ/Redis, S3
packages/
  shared/   Enums and types shared between web and api (roles, intake status, document types)
```

Orchestrated with **Turborepo** + npm workspaces.

## Architecture

```
Frontend (Next.js)  →  REST API / HTTPS  →  Backend (NestJS)
                                              ├── PostgreSQL (Prisma)
                                              ├── Redis + BullMQ
                                              ├── Amazon S3 (documents)
                                              └── Email / AI / OCR (pluggable providers)
```

Every external dependency that might change providers over time is
wrapped behind a DI interface so swapping implementations is a config
change, not a refactor:

| Concern | Interface | V1 implementation | Future |
|---|---|---|---|
| Email | `EmailProvider` (`providers/email`) | `StubEmailProvider` (logs only) | MailHippo, SendGrid, SES, Mailgun |
| File storage | `StorageProvider` (`providers/storage`) | `S3StorageProvider` against LocalStack locally / real S3 in prod | unchanged — same interface |
| AI summary | `AiSummaryProvider` (`providers/ai`) | `DbGeneratedSummaryProvider` (template from structured data) | Claude API (`ClaudeSummaryProvider`, falls back to DB summary on error), OpenAI, Gemini |
| OCR | `OcrProvider` (`providers/ocr`) | `NoopOcrProvider` (stores raw file only) | AWS Textract, Google Vision, Azure Document Intelligence |
| Jane EHR export | `JaneExportAdapter` (`providers/jane-export`) | Manual staff upload + "mark completed" | Direct API push, if Jane ever offers one |

All provider selection is env-driven (`EMAIL_PROVIDER`, `AI_PROVIDER`,
etc. — see `.env.example`) and resolved via NestJS `useFactory` providers,
never hardcoded imports in feature modules.

## Multi-tenancy

Every clinical/business table carries a `clinicId` (see
`apps/api/prisma/schema.prisma`). Application-layer queries are scoped by
the authenticated user's clinic — there is no cross-tenant query path.
Per-clinic `logoUrl`, `brandingConfig`, and `settings` live on the `Clinic`
model so onboarding a new clinic is a data operation, not a deploy.

## Local development

Requires Docker Desktop, Node 20+, npm 10+.

```bash
cp .env.example .env
npm install
npm run docker:up          # Postgres + Redis + LocalStack (S3 emulator)
npm run prisma:migrate --workspace=apps/api
npm run dev                 # runs apps/web (:3000) and apps/api (:4000) together
```

By default every external provider runs in **stub mode**
(`AUTH_PROVIDER=stub`, `EMAIL_PROVIDER=stub`, `AI_PROVIDER=db_generated`,
`STORAGE_PROVIDER=s3` pointed at the local LocalStack container) — the
full intake workflow runs end-to-end with zero real third-party accounts.
Flip the corresponding `*_PROVIDER` env var and supply credentials to go
live with Clerk, MailHippo, or the Claude API; no code changes required.

## Build approach

This project is being built module-by-module rather than all at once —
each module (Auth, Clinics, Patients, Appointments, Patient Intake,
Documents, Consent Forms, Notifications, AI, Audit Logs, Dashboard,
Reports, Settings) is designed, implemented, and tested independently, with
a pause for review before moving to the next.

**Phase 0 (this commit):** monorepo scaffold, multi-tenant Prisma schema,
NestJS app core (config validation, security middleware, Prisma/Redis/
BullMQ wiring, provider abstractions above), Next.js app core (Tailwind,
shadcn/ui, TanStack Query, Zustand, route shells for the staff dashboard
and patient portal).

**Next up:** Auth Module (Clerk integration, JWT, RBAC guards) + Clinics
Module (tenant CRUD, branding/settings).

## Testing

Jest (+ Supertest for API e2e) in both apps. Run `npm run test` at the
root to run every workspace's suite via Turborepo.
