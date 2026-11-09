import type { Instrumentation } from "next";

/**
 * One structured log line for every server error Next.js catches — server
 * components, route handlers, server actions and the proxy. On Vercel these
 * land in the function logs with the `digest` users see on the error page,
 * so a report like "it showed error 1234567" can be traced.
 *
 * Deliberately left out: request headers (cookies hold session tokens) and
 * the query string (it can carry phone numbers). To forward errors to a
 * monitoring service later, send the same `entry` from here.
 */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const err: Partial<Error> & { digest?: string } =
    error instanceof Error ? error : { name: "NonError", message: String(error) };
  const entry = {
    digest: err.digest ?? null,
    name: err.name,
    message: err.message,
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    stack: err.stack?.split("\n").slice(0, 8).join("\n"),
  };
  console.error("[request-error]", JSON.stringify(entry));
};
