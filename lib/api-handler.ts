import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler<P = any> = (
  req: NextRequest,
  ctx: { params: Promise<P> },
) => Promise<NextResponse>;

/**
 * Wraps a Route Handler with consistent error handling:
 * - AppError instances are converted to typed JSON responses.
 * - Unknown errors are logged and returned as opaque 500 responses
 *   (no stack traces exposed to clients).
 */
export function withHandler<P>(handler: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        return err.toResponse();
      }
      console.error("[withHandler] Unhandled error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
