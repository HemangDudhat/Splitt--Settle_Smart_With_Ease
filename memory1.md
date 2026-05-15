# Project Context: Splitt

## Overview
Splitt is a modern, smart bill-splitting application designed to help users track shared expenses and settle debts with ease. It features real-time updates, AI-powered spending insights, and automated payment reminders.

## Technology Stack
- **Frontend**: Next.js 16 (App Router), React 19, Lucide React (Icons).
- **Styling**: Tailwind CSS 4, Framer Motion (Animations), Shadcn UI (Component Library).
- **Backend/Database**: Convex (Real-time sync, serverless functions).
- **Authentication**: Clerk (@clerk/nextjs).
- **Background Tasks**: Inngest (Cron jobs and workflow orchestration).
- **AI Integration**: Google Generative AI (Gemini 2.5 Flash) for financial analysis.
- **Communication**: Resend / Mailersend (Email notifications).
- **Forms/Validation**: React Hook Form, Zod.

## Core Features
- **Dashboard**: Overview of total balances (what you owe and what is owed to you).
- **Expense Management**: Add expenses with various split types (Equal, Percentage, Exact Amount).
- **Group Tracking**: Organize expenses by groups (e.g., "Roommates", "Trip to Paris").
- **Settlement System**: Record payments between users to balance the books.
- **Real-time Sync**: Instant updates across all clients using Convex's reactive engine.
- **Automated Reminders**: Daily Inngest jobs to remind users of outstanding debts.
- **Spending Insights**: Monthly AI-generated reports analyzing spending patterns and providing saving tips.

## Data Schema (Convex)
- **users**: Stores user profiles (name, email, tokenIdentifier, imageUrl).
- **expenses**: Detailed expense records.
    - Fields: description, amount, category, date, paidByUserId, splitType, splits (array of userId, amount, paid status), groupId (optional).
- **settlements**: Payment records between users.
    - Fields: amount, note, date, paidByUserId, receivedByUserId, groupId (optional), relatedExpenseIds.
- **groups**: Collective expense containers.
    - Fields: name, description, createdBy, members (array of userId, role, joinedAt).

## Key Directory Structure
- `app/`: Next.js application routes.
    - `(auth)`: Authentication pages (Clerk).
    - `(main)`: Core application (Dashboard, Expenses, Groups, etc.).
    - `api/inngest`: Inngest endpoint serving background functions.
- `convex/`: Backend logic and database schema.
    - `schema.js`: Database definitions.
    - `inngest.js`: Specific queries for Inngest jobs.
    - `users.js`, `expenses.js`, etc.: API functions for CRUD and business logic.
- `components/`: UI components.
    - `ui/`: Shared base components (Shadcn).
    - `expense-list.jsx`, `group-balances.jsx`, etc.: Feature-specific components.
- `lib/`: Shared utilities and service clients.
    - `inngest/`: Background job definitions (`spending-insights.js`, `payment-reminders.js`).

## Operational Workflows
1. **User Auth**: Users sign in via Clerk. On first login, they are synced to the Convex `users` table.
2. **Expense Flow**: A user adds an expense -> Convex calculates splits -> Real-time UI updates for all participants.
3. **Settlement Flow**: A user records a payment -> Settlement record created -> Outstanding balances updated instantly.
4. **AI/Cron**: 
    - Daily (10 AM UTC): Inngest scans for debts and sends emails.
    - Monthly (1st at 8 AM): Inngest gathers user data, passes it to Gemini, and sends a "Spending Insights" email.
