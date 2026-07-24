import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type Source = "body" | "query" | "params";

export function validate(schema: ZodSchema, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Pass the full request shape so schemas that validate multiple
    // sources (e.g. body + params for PATCH routes) all resolve correctly.
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      const flattened = result.error.flatten();
      console.error('[Validation Middleware] Validation failed:', {
        path: req.path,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
        fieldErrors: flattened.fieldErrors,
        formErrors: flattened.formErrors,
      });
      res.status(400).json({
        error: "Validation failed",
        details: flattened,
      });
      return;
    }
    // Apply parsed/coerced values back to the request
    const data = result.data as any;
    if (data.body) req.body = data.body;
    if (data.query) (req as any).query = data.query;
    if (data.params) (req as any).params = data.params;
    next();
  };
}

