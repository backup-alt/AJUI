import { Request, Response, NextFunction } from "express";
import { isProduction } from "../config/env.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  if (err.name === "ValidationError") {
    const details = Object.values((err as any).errors).map((e: any) => e.message);
    res.status(400).json({ error: details.join(", ") });
    return;
  }

  if (err.name === "CastError") {
    res.status(400).json({ error: `Invalid value for ${(err as any).path}: ${(err as any).value}` });
    return;
  }

  console.error("[ERROR]", err);

  res.status(500).json({
    error: "Internal server error",
    ...(isProduction ? {} : { stack: err.stack, details: err.message }),
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found" });
}
