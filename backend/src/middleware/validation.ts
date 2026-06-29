import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type Source = "body" | "query" | "params";

export function validate(schema: ZodSchema, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ [source]: req[source] });
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
      return;
    }
    if (source === "body") req.body = result.data.body ?? result.data;
    next();
  };
}
