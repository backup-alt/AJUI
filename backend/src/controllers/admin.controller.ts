import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";

const deactivateSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().min(8).max(20).optional(),
  }).refine((data) => data.email || data.phone, {
    message: "Either email or phone is required",
  }),
});

export async function deactivateSupervisor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, phone } = deactivateSchema.parse(req.body).body;
    const deactivatedBy = req.user?.sub;
    if (!deactivatedBy) throw new AppError(401, "Not authenticated");

    const result = await authService.deactivateUser({ email, phone }, deactivatedBy);

    res.json({
      success: true,
      message: "Supervisor deactivated successfully",
      supervisor: result,
    });
  } catch (err) {
    next(err);
  }
}