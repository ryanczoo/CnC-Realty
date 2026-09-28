// A Prisma `where` that finds rows with this exact email, ignoring
// capitalization (nothing lowercases on write, so `John@Example.com` is stored
// as typed and a plain `=` would miss it).
//
// `mode: "insensitive"` makes Prisma emit ILIKE and pass the value through as
// the *pattern*. `%` and `_` are legal in an address's local part, so unescaped
// they'd act as wildcards (`a%@example.com` would match the whole domain).
// Escape them, and backslash itself — Postgres's default LIKE escape.
export function emailMatchWhere(email: string) {
  return { email: { equals: email.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } };
}
