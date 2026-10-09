# Household Feature Spec

Status: Draft
Scope: Household onboarding, membership, and the Family Hub / Member Profile surfaces.
Source of truth for entities: `src/db/schema.ts` (do not change the schema without an explicit request).

## Overview

A household is the unit that owns members and all shared data. A person creates a
household, becomes its admin, and shares a short-lived invite code so others can join
from their own device. Roles are display labels only; the only behavioral flag is
`isAdmin`.

## Entities

Every row inherits `BaseRow`: `id` (`crypto.randomUUID()`), `updatedAt` (ISO 8601 string),
`updatedBy`, `deleted` (soft delete; never hard-delete).

### Household

Table: `households`. Indexed: `id`, `inviteCode`, `updatedAt`.

| Field             | Type    | Required | Notes                                                                 |
| ----------------- | ------- | -------- | --------------------------------------------------------------------- |
| `id`              | string  | yes      | UUID (`crypto.randomUUID()`).                                         |
| `name`            | string  | yes      | Household display name, e.g. "The Santos family".                     |
| `inviteCode`      | string  | yes      | Current active code; 6 chars from the invite alphabet. One per household. |
| `inviteExpiresAt` | string  | yes      | ISO 8601 instant, 24 hours after the code was issued.                 |
| `updatedAt`       | string  | yes      | ISO 8601.                                                             |
| `updatedBy`       | string  | yes      | Member id or user id of the last writer.                              |
| `deleted`         | boolean | yes      | Soft delete.                                                          |

### Member

Table: `members`. Indexed: `id`, `householdId`, `userId`, `updatedAt`.

| Field         | Type    | Required | Notes                                                                 |
| ------------- | ------- | -------- | --------------------------------------------------------------------- |
| `id`          | string  | yes      | UUID (`crypto.randomUUID()`).                                         |
| `householdId` | string  | yes      | FK to `households.id`.                                                |
| `name`        | string  | yes      | Display name.                                                         |
| `photo`       | string  | no       | Image reference (data URL or path).                                   |
| `contact`     | string  | no       | Free-form contact detail.                                             |
| `birthday`    | string  | no       | `YYYY-MM-DD` (date only, not an instant).                             |
| `roleLabel`   | string  | yes      | Display-only label, e.g. "Mother", "Son". Carries no permissions.     |
| `color`       | string  | yes      | Avatar/theme color token.                                             |
| `isAdmin`     | boolean | yes      | Only behavioral flag. Creator is admin.                                |
| `userId`      | string  | no       | Auth user id when the member is linked to a signed-in account.        |
| `updatedAt`   | string  | yes      | ISO 8601.                                                             |
| `updatedBy`   | string  | yes      | Member id or user id of the last writer.                              |
| `deleted`     | boolean | yes      | Soft delete.                                                          |

## Rules

### Invite code

- Alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (23 letters + 8 digits = 31 symbols).
  Ambiguous characters `I`, `L`, `O`, `0`, `1` are excluded for readability.
- Length: exactly 6 characters.
- `inviteExpiresAt` = code issue time + 24 hours.
- The code is **reusable by multiple members** until it expires; each successful use
  creates one new `Member` in the household.
- **One active code per household.** A household has at most one current `inviteCode`
  / `inviteExpiresAt` pair.
- Months after issue it is expired: joining with an expired code must fail.
- **An admin can regenerate** the code at any time: new 6-char code, new 24h expiry,
  old code immediately invalid. Only members with `isAdmin === true` may regenerate.
- Lookups by code use the indexed `inviteCode` field with `.first()`, and must
  `.filter(r => !r.deleted)`.

### Membership and roles

- Creating a household makes the creator a `Member` in that household with
  `isAdmin === true`.
- Roles are labels only. `roleLabel` never grants or denies any capability.
- `isAdmin` is the only capability flag; it governs invite regeneration (and, later,
  other household administration).
- Joining by code appends a new member to the existing household; it never mutates or
  replaces existing members.

### Data invariants

- All ids are `crypto.randomUUID()`; all timestamps are ISO 8601 strings.
- `deleted` is never added to a Dexie index. Every query filters
  `.filter(r => !r.deleted)`.
- Deletes are soft: set `deleted = true`, bump `updatedAt` / `updatedBy`.
- Components never touch Dexie directly; they call a service or repository. Feature
  scope is `src/features/household/`; logic files are plain TypeScript with no React
  imports.

## Screens

Mapped to visual references in `.reference/kubohub-main/` (reference only — never import
from it; copy and adapt into `src/features/household/components/`).

| Screen          | Reference basis                                   | Purpose / key actions                                                                 |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Sign In         | none in reference                                 | Establish the local user identity; entry point.                                      |
| Create or Join  | `invite` dialog (`kubo-app.tsx`, "Grow your circle") | Create a household (creator becomes admin) **or** join with a 6-char code.        |
| Profile Setup   | `member` dialog (`kubo-app.tsx`)                  | Set the current member's `name`, `roleLabel`, `color`, optional `photo` / `contact` / `birthday`. |
| Family Hub      | `HomeView`, route `/` (`routes/index.tsx`)        | Dashboard: greeting, family circle, and quick links to household data.               |
| Member Profile  | `member` dialog (`kubo-app.tsx`)                  | View a member's profile. Admin sees regenerate-invite; opened from Family Hub / circle list. |

## Acceptance test

### AT-1: Second device joins with the code and sees the same members within 5 seconds

Preconditions:
- Device A has created a household and is signed in as its admin (creator).
- The household has an active, non-expired `inviteCode`.

Steps:
1. On Device A, open Create or Join and read the displayed 6-char invite code.
2. On Device B (separate device/browser profile with its own local database), open
   Create or Join, choose Join, and enter the code.
3. Complete Profile Setup on Device B.
4. Observe Device B's Family Hub, then Device A's Family Hub.

Expected:
- Device B joins the **existing** household (does not create a new one) and appears as a
  new `Member` in it.
- Within **5 seconds**, Device B's Family Hub shows the same member set as Device A,
  including the admin and the newly joined member.
- Within **5 seconds**, Device A's Family Hub shows the newly joined member.
- No existing members are modified or lost on either device.
- Each device keeps its own local copy in IndexedDB (local-first); convergence happens
  through sync within the 5-second bound.

Related checks (derived):
- AT-2: A code older than 24 hours is rejected when joining.
- AT-3: A regenerated code invalidates the previous code immediately; only an admin can
  regenerate.
- AT-4: After a member is soft-deleted, neither device's Family Hub lists that member
  within the 5-second bound.
