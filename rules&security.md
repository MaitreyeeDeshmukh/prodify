# SaaSify Agent Rules and Security Policy

## 1. Purpose

This document defines the mandatory rules for SaaSify when it scans, transforms, or generates code for a user repository. These rules are designed to keep the system safe, reviewable, and production-ready.

## 2. Writing standards

- Do not use em dashes in UI text, docs, prompts, or generated comments.
- Keep all comments concise, direct, and professional.
- Do not add decorative, vague, or redundant comments.
- Prefer plain language over clever phrasing.
- Keep generated UI copy short and actionable.

## 3. Output style

- Default to clear, minimal output.
- Explain only what is necessary.
- Use short labels, short descriptions, and short comments.
- Never rely on verbose prose to hide uncertainty.
- If the system is unsure, say so plainly and stop.

## 4. Secrets and environment safety

- Never commit `.env` files.
- Never commit live secrets, API keys, service-role keys, database URLs, or webhook secrets.
- Never print secrets to logs.
- Never write secrets into markdown, config examples, or generated code.
- Never expose server-only values to the client.
- Only use placeholder values in generated files.
- Treat all environment files as local-only unless explicitly documented otherwise.

## 5. Database safety

- Never ship user-owned tables without Row Level Security.
- Never use permissive policies that expose all rows.
- Never trust client-supplied role, ownership, or plan flags.
- Never allow direct access to admin-only data without server-side checks.
- Never create or modify schemas without clear user approval.
- Never assume a table is safe just because it is in Supabase.

## 6. Auth and access control

- Every mutating route must verify authentication.
- Every privileged route must verify authorization on the server.
- Never trust user IDs from the client.
- Never trust client-side billing flags.
- Never trust client-side role claims without server validation.
- Use server-side checks for protected routes, billing access, and admin actions.

## 7. Payments and webhook safety

- Always verify Stripe webhook signatures.
- Treat webhook payloads as untrusted input.
- Handle duplicate webhook deliveries safely.
- Reconcile billing state on the server.
- Never grant access only from a client-side payment success screen.
- Never hardcode Stripe secret keys or product identifiers in production code.

## 8. Input validation

- Validate every input before use.
- Sanitize all values that reach SQL, shell, HTML, file paths, or third-party APIs.
- Use parameterized queries or safe query builders.
- Reject malformed, missing, or unexpected inputs.
- Never pass raw user input into queries or commands.

## 9. File and upload safety

- Never allow unrestricted file uploads.
- Validate file type, file size, and file path.
- Store uploads in isolated locations.
- Never assume uploaded content is safe.
- Never let user input write to arbitrary filesystem paths.

## 10. Dependency and supply chain safety

- Review new dependencies before adding them.
- Pin package versions.
- Prefer small, well-known dependencies.
- Avoid unnecessary transitive packages.
- Require a lockfile.
- Reject changes that add risky dependencies without justification.

## 11. Build and deploy safety

- Block production readiness if secrets are missing or exposed.
- Block production readiness if RLS is missing where required.
- Block production readiness if webhook verification is missing.
- Block production readiness if auth or authorization checks are incomplete.
- Always generate a pre-deploy checklist.
- Never silently deploy changes.

## 12. Repo mutation rules

- Never modify a repo without explicit user approval.
- Always create a new git branch before applying changes.
- Always show a plan before mutation.
- Always show a reviewable diff after mutation.
- Never overwrite conflicting files without warning.
- Fail closed if the repo shape is unsupported.

## 13. Supported-stack behavior

- Only operate on explicitly supported stacks.
- If the detected stack is unsupported, stop and explain why.
- Do not guess at framework structure.
- Do not invent missing architecture.
- Do not force a transform onto a repo that does not match the supported pattern.

## 14. Error handling

- Fail with clear, short, actionable messages.
- Do not hide errors behind generic failures.
- Do not continue after a critical security issue.
- Do not auto-fix risky issues without user review.
- If a safe transformation is not possible, stop.

## 15. Required preflight checks

Before any apply step, SaaSify must verify:

- Git repository exists.
- Working tree state is known.
- Supported stack is detected.
- No critical secrets are exposed.
- Required auth patterns are present or can be added safely.
- RLS requirements are understood.
- Stripe webhook handling can be implemented safely.
- The user has approved the plan.

## 16. Security stop conditions

SaaSify must stop immediately if any of the following are true:

- A live secret is detected in tracked or generated files.
- The repo lacks required auth and access-control boundaries.
- The repo would be made public without RLS on sensitive tables.
- The billing flow cannot be verified safely.
- The repo structure is too ambiguous for a safe patch.
- The transform would require unsafe guessing.
- The user has not approved the plan.

## 17. Agent behavior

- Be conservative.
- Be explicit.
- Be predictable.
- Be reviewable.
- Be safe by default.
- Prefer a clean refusal over a risky guess.

## 18. Commenting rules for generated code

- Comments must be short.
- Comments must explain intent, not restate code.
- Comments must not be verbose.
- Comments must not be casual or playful.
- Comments must not contain em dashes.

## 19. UI text rules

- Keep UI labels short.
- Keep instructions direct.
- Avoid filler.
- Avoid technical jargon unless necessary.
- Avoid em dashes.
- Prefer plain language.

## 20. Final principle

If a change increases risk, ambiguity, or hidden complexity, SaaSify must not auto-apply it. The system should always choose the safest reviewable path.