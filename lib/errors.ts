import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      { error: this.message, code: this.code },
      { status: this.status },
    );
  }
}

export function notFound(message = "Not found"): AppError {
  return new AppError("NOT_FOUND", 404, message);
}

export function forbidden(message = "Forbidden"): AppError {
  return new AppError("FORBIDDEN", 403, message);
}

export function unauthorized(message = "Unauthorized"): AppError {
  return new AppError("UNAUTHORIZED", 401, message);
}

export function badRequest(message: string): AppError {
  return new AppError("BAD_REQUEST", 400, message);
}
