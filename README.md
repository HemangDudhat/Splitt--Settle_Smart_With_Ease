# 💸 Splitt

**Splitt** is a smart expense-sharing platform that helps individuals and groups split expenses seamlessly and settle balances whenever desired. It automates reminders, provides monthly spending insights, and makes managing shared finances effortless.

---

## 🚀 Overview

Managing shared expenses can get messy—especially in groups.  
**Splitt** simplifies this by allowing users to track expenses, split costs fairly, settle dues, and receive automated reminders and insights — all in one place.

Whether it’s friends, roommates, or trips, Splitt keeps finances transparent and stress-free.

---

## ✨ Features

- 🔐 Authentication with Clerk  
- 👥 Create or join groups  
- 💰 Add & manage expenses  
- ➗ Split expenses between individuals or groups  
- ✅ Settle expenses anytime  
- 📧 Daily email reminders for pending payments  
- 📊 Monthly expenditure insights  
- ⚡ Background jobs & notifications powered by Inngest  

---

## 🛠 Tech Stack

### Frontend
- Next.js
- Tailwind CSS

### Authentication
- Clerk

### Database & Backend Logic
- Convex

### Email & Notifications
- Resend
- Inngest

### AI (Optional / Insights)
- Gemini API

---

## 🔄 Application Flow

1. User signs up / logs in  
2. User creates or joins a group  
3. Expenses are added  
4. Expenses are split among individuals or groups  
5. Expenses can be settled anytime  
6. Users receive:
   - Daily email reminders for pending payments  
   - Monthly insights of their expenditure  

---

## ⚙️ Installation & Setup

### 📋 Prerequisites

Ensure you have the following:

- Node.js 18+
- A Convex account
- A Clerk account
- A Resend account
- An Inngest account

---

### 🧩 Setup Steps

1. Clone the repository
   ```bash
   git clone <repository-url>
2. Install dependencies
   ```bash
   npm install
3. Run the project locally by running the following commands simultaneously in separate terminals:
   ```bash
   npm run dev
   npx convex dev
   npx inngest-cli@latest dev

## Environment variables

```
# Convex (Deployment)
# CONVEX_DEPLOYMENT=your_convex_deployment_id
# NEXT_PUBLIC_CONVEX_URL=your_convex_url

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

CLERK_JWT_ISSUER_DOMAIN=your_clerk_jwt_issuer_domain

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_resend_domain

# AI Insights
GEMINI_API_KEY=your_gemini_api_key
```
