# Manticode

AI-powered coding assistant delivered as a Telegram Mini App. Chat with AI, review patches, manage files — all without leaving Telegram.

**Live at [manticthink.com](https://manticthink.com)** · **[Open in Telegram](https://t.me/ForgeCodeBot)**

---

## Architecture

```
Manticode/
├── apps/
│   ├── landing/        Cloudflare Worker — marketing site at manticthink.com
│   ├── api/            Fastify 5 REST API — auth, chat, files, patches
│   ├── web/            Next.js 14 Telegram Mini App frontend
│   └── bot/            Standalone Telegram bot (long-polling)
├── packages/
│   └── shared/         TypeScript types shared across all apps
├── turbo.json          Turborepo task config
├── pnpm-workspace.yaml Workspace definitions
└── tsconfig.base.json  Shared compiler options
```

Monorepo managed with **pnpm 9** and **Turborepo 2**.

## Core Features

**Telegram Auth** — Login via Telegram WebApp HMAC-SHA256 signature. JWT sessions. Default workspace created on first login.

**AI Chat** — Real-time SSE streaming from GPT-4o or Claude. Project files automatically included as context. History truncated to fit token budget.

**Code Patches** — AI responses parsed into structured diffs. Review file-by-file, approve or reject, apply with versioned history.

**Workspaces** — Multi-workspace with owner/editor/viewer roles. Invite collaborators by Telegram username.

**File Management** — CodeMirror editor, file tree, multipart upload (5MB), automatic version tracking.

**Telegram Bot** — `/ask`, `/reset`, `/help` commands. Group chat support with mention detection.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Fastify 5, Prisma 6, ioredis 5, Zod, JWT |
| Frontend | Next.js 14, React 18, Zustand 5, CodeMirror 6, Tailwind CSS 3 |
| Telegram | @telegram-apps/sdk-react 2.0 |
| AI | OpenAI (GPT-4o), Anthropic (Claude) |
| Infra | Cloudflare Workers, PostgreSQL 16, Redis 7, Docker |
| Tooling | pnpm 9, Turborepo 2, TypeScript 5.7 |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start all apps in dev mode
pnpm dev

# Or run individually
cd apps/api && pnpm dev
cd apps/web && pnpm dev
```

Copy `.env.example` to `.env` and fill in your keys before starting.

## Deploy

```bash
# Landing page → Cloudflare
pnpm deploy:landing

# API → Cloudflare Workers (or Docker)
pnpm deploy:api
```

## Data Model

```
User
 └── Workspace (members with roles)
       └── Project
             ├── ProjectFile → FileVersion[]
             └── ChatThread
                   └── ChatMessage
                         └── PatchProposal
                               └── PatchFileChange[]

ActivityEvent (audit log)
UsageRecord (token cost tracking)
```

## Security

- Telegram HMAC-SHA256 signature validation
- JWT authentication on all API routes
- Role-based permissions (owner / editor / viewer)
- Rate limiting (100 req/min)
- Zod input validation
- Workspace-level data isolation

## License

Proprietary — © 2026 ManticThink. All rights reserved.
