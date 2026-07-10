---
name: license-auth-project
description: LicenseAuthSystem domain rules and architecture. Use when implementing license validation, activation, authentication flows, API integration, or any business logic specific to this project.
---

# LicenseAuthSystem — Project Domain

Domain-specific guidance for the license authentication system.

## Overview

This project manages software license authentication: activation, validation, and session management.

> **Note:** Fill in concrete API endpoints, data models, and flows as the backend and Client are implemented.

## Principles

- **Server-side validation is authoritative.** Client-side checks improve UX only.
- **Fail closed.** Invalid or expired licenses must block access, not degrade silently.
- **No secrets in the client.** API keys, signing secrets, and raw license payloads stay server-side.
- **Audit trail.** Log activation, deactivation, and validation failures (without leaking license keys).

## Domain Concepts

| Concept | Description |
|---------|-------------|
| License key | User-facing activation code |
| Activation | Binding a license to a device or account |
| Validation | Periodic check that a license is still valid |
| Session | Authenticated state after successful validation |

## When Implementing

1. Read root `AGENTS.md` for build/test commands and global conventions.
2. Apply `skills/client/react-best-practices/` for React/Next.js performance work.
3. Apply `skills/client/composition-patterns/` for UI component design.
4. Update this file when domain rules, API contracts, or data models change.

## API Contracts

<!-- Add endpoint specs, request/response shapes, and error codes here -->

## Data Models

<!-- Add TypeScript types or schema references here -->
