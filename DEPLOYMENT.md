# Production Deployment Guide: Render (Backend) & Cloudflare Pages (Frontend)

This guide walks you through deploying the **Soundabode** full-stack web application to **Render** (Express Node.js Backend API) and **Cloudflare Pages** (Vite React Single Page Application).

---

## Part 1: Deploy Backend API to Render

### Option A: 1-Click Deployment using Render Blueprint
1. Push your repository to GitHub / GitLab.
2. Log into [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repository. Render will automatically detect [`render.yaml`](file:///Users/devangdhakate/Desktop/MRSSE/render.yaml).
5. Fill in the required environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `ADMIN_PASSCODE`: Secure passcode for admin access.
   - `ASHU_PASSCODE`: Secure passcode for Ashu account.
   - `VAIBHAV_PASSCODE`: Secure passcode for Vaibhav account.
   - `GOOGLE_SHEETS_URL`: Your Google Apps Script webhook URL.
6. Click **Apply**. Render will build and deploy your API web service.
7. Once deployed, note down your Render Web Service URL (e.g. `https://soundabode-backend-api.onrender.com`).

### Option B: Manual Render Web Service Setup
- **Name**: `soundabode-backend-api`
- **Environment**: `Node`
- **Region**: `Singapore` (or region closest to your audience)
- **Build Command**: `cd server && npm install`
- **Start Command**: `cd server && npm start`
- **Health Check Path**: `/api/health`

---

## Part 2: Deploy Frontend to Cloudflare Pages

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages**.
2. Click **Create Application** -> **Pages** -> **Connect to Git**.
3. Select your repository and configure the build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (Leave empty or set to root)
4. Add **Environment Variables** under Environment Variables:
   - `VITE_API_URL`: `https://soundabode-backend-api.onrender.com/api` (Replace with your actual Render API URL)
   - `VITE_GOOGLE_SHEETS_URL`: `https://script.google.com/macros/s/.../exec`
5. Click **Save and Deploy**.

---

## Verification & Post-Deployment Checklist

1. **Verify Backend Health**:
   Visit `https://soundabode-backend-api.onrender.com/api/health` in your browser.
   Expect response: `{ "status": "ok", "mongodb": "connected", "uriConfigured": true }`.

2. **Verify Frontend Single Page Routing**:
   Visit your Cloudflare Pages URL (e.g., `https://soundabode.pages.dev/admission`).
   Direct page navigation should work smoothly without 404 errors (handled by [`public/_redirects`](file:///Users/devangdhakate/Desktop/MRSSE/public/_redirects)).

3. **Verify Security Headers**:
   Run `curl -I https://soundabode-backend-api.onrender.com/api/health` to verify:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - `Referrer-Policy: strict-origin-when-cross-origin`
