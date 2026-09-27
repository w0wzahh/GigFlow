import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthRequiredError, getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * API helpers — consistent response envelope and auth/validation plumbing.
 *
 * Success:  { data: ... }
 * Failure:  { error: { code, message, details? } }
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errors = {
  unauthorized: () => new ApiError(401, "UNAUTHORIZED", "You must be signed in."),
  forbidden: () => new ApiError(403, "FORBIDDEN", "You do not have access to this resource."),
  notFound: (what = "Resource") => new ApiError(404, "NOT_FOUND", `${what} not found.`),
  badRequest: (msg: string, details?: unknown) => new ApiError(400, "BAD_REQUEST", msg, details),
  conflict: (msg: string) => new ApiError(409, "CONFLICT", msg),
  tooMany: (retryAfterSec: number) =>
    new ApiError(429, "RATE_LIMITED", `Too many requests. Try again in ${retryAfterSec}s.`),
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function fail(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "Request validation failed.",
          details: err.flatten(),
        },
      },
      { status: 422 },
    );
  }
  if (err instanceof AuthRequiredError) {
    return fail(errors.unauthorized());
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

export async function parseBody<S extends ZodType>(
  req: Request,
  schema: S,
): Promise<ReturnType<S["parse"]>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw errors.badRequest("Request body must be valid JSON.");
  }
  return schema.parse(json) as ReturnType<S["parse"]>;
}

/**
 * Wrap an authenticated route handler. Injects the session user and converts
 * thrown errors into the standard envelope.
 */
export function withAuth<P = unknown>(
  handler: (req: Request, ctx: { user: SessionUser; params: P }) => Promise<Response>,
) {
  return async (req: Request, routeCtx: { params: Promise<P> }): Promise<Response> => {
    try {
      const user = await getSessionUser();
      if (!user) throw errors.unauthorized();
      const params = (await routeCtx.params) as P;
      return await handler(req, { user, params });
    } catch (err) {
      return fail(err);
    }
  };
}

/** Wrap a public route handler with the standard error envelope. */
export function withErrors(
  handler: (req: Request) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      return fail(err);
    }
  };
}

/**
 * CSRF guard for cookie-authenticated mutations: require a same-origin
 * request. Combined with SameSite=Lax cookies this blocks cross-site POSTs.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests) have no Origin
  const host = req.headers.get("host");
  try {
    if (new URL(origin).host !== host) {
      throw new ApiError(403, "CSRF", "Cross-origin request rejected.");
    }
  } catch {
    throw new ApiError(403, "CSRF", "Cross-origin request rejected.");
  }
}
