---
name: secure-coding-review
description: Review code changes and existing codebases for security best practices — access control, input validation, injection risks, authentication handling, secrets management, and safe defaults. Use before merging any route, controller, or model change, when setting up a new API endpoint, when handling file uploads or payments, or when the user wants their own codebase reviewed for security gaps and hardened against common mistakes. This is a defensive code-quality review performed on code the user owns, not an offensive security or exploitation task.
---

# Secure Coding Review

A skill for reviewing and hardening a codebase against common, well-documented security mistakes (OWASP Top 10 territory), applied as a standard engineering review — the same category of work as a lint pass or a code review.

## Scope

This skill applies to code the user owns and has authorization to modify. The goal is finding and fixing gaps against secure coding best practices, the same way a senior engineer would review a pull request.

## Review checklist

### 1. Database queries
- Confirm parameterized queries / ORM methods are used, never string-concatenated user input
- For MongoDB/Mongoose: confirm user-supplied objects can't inject operators (`$where`, `$gt`, `$regex`, `$ne`) into filters — use `express-mongo-sanitize` or explicit field whitelisting
- Confirm query results are scoped to the requesting user where relevant, not just filtered client-side

### 2. Access control
- Every route that reads/updates/deletes a specific resource by ID must verify the requester owns or is authorized for that resource — not just that they're authenticated (this is the most common real-world bug: IDOR)
- Admin-only routes must check role server-side; never trust a role/permission value sent from the client
- Confirm auth middleware is applied consistently — check for routes that were added without it

### 3. Authentication
- Passwords hashed with bcrypt/argon2, appropriate salt/cost factor
- JWT secrets loaded from environment variables, never hardcoded or committed
- Access tokens short-lived; refresh tokens rotate and can be revoked
- Rate limiting present on login, signup, OTP, and password-reset endpoints
- Session/auth cookies set with `httpOnly`, `secure`, and `sameSite` flags

### 4. Input validation & XSS
- Server-side schema validation (Zod/Joi/express-validator) on all request bodies — frontend validation alone is not sufficient
- Any use of `dangerouslySetInnerHTML` is sanitized with DOMPurify
- User-generated content rendered anywhere is escaped, not trusted as-is

### 5. CSRF
- If cookie-based auth is used, confirm CSRF tokens or strict `sameSite` cookie configuration

### 6. File uploads
- File type and size validated server-side (not just by extension or client-reported mimetype, both spoofable)
- Uploaded files stored outside any publicly executable path
- Filenames checked for path traversal (`../`) before use in file system operations

### 7. Secrets & configuration
- Search the repo (and ideally git history) for hardcoded API keys, DB connection strings, or secrets
- Confirm `.env` is gitignored and was never committed
- CORS scoped to specific known origins — never `*` combined with `credentials: true`

### 8. Business logic
- Mass assignment risk: check for patterns like `Object.assign(model, req.body)` that let a client set fields such as `role`, `isAdmin`, or `price` directly — require explicit field whitelisting
- Payment webhook handlers (Stripe/Razorpay) verify the signature against the **raw** request body before trusting the payload — this is a frequent, high-severity miss
- Public and AI-backed endpoints have rate limiting to prevent cost/resource abuse

### 9. General hardening
- `helmet.js` or equivalent security headers applied
- Production error handlers don't leak stack traces or internal details
- HTTPS/HSTS enforced in production
- Dependency versions checked for known high/critical CVEs

## Output format

1. Summary table: `Area | File | Finding | Severity | Fixed / Needs Review`
2. Apply direct fixes for anything clear and safe (sanitization, missing headers, validation gaps)
3. Flag anything touching core auth flow or payment logic for manual review rather than auto-fixing — explain the risk and the recommended fix, but don't change behavior silently
4. List which features should be manually retested after changes are applied

## Priority order for large codebases

When time/scope is limited, review in this order — it matches where real-world breaches actually happen:
1. Access control on any admin or user-data routes (IDOR)
2. Payment webhook signature verification
3. Mass assignment on PATCH/PUT endpoints
4. Query sanitization (NoSQL injection)
5. Everything else
