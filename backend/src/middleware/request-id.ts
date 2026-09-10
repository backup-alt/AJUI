import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * LOW-5 fix: Request ID tracing middleware.
 * Generates a unique ID for each request to trace it across services and logs.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing X-Request-ID from upstream proxy/load balancer, or generate new one
  const existingId = req.headers["x-request-id"] as string | undefined;
  const requestId = existingId || `req_${crypto.randomBytes(8).toString("hex")}`;

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  // Log request start
  const startTime = Date.now();
  console.log(`[${requestId}] ${req.method} ${req.path} - START`);

  // Log request end
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
}
