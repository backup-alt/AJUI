import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { AccessTemplate } from "../models/AccessTemplate.js";

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

// Access Templates CRUD
const approvalTypeSchema = z.object({
  canApprove: z.boolean(),
  canReject: z.boolean(),
});

const accessTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    role: z.enum(["admin", "project_manager", "accountant", "supervisor"]),
    approvalTypes: z.object({
      material: approvalTypeSchema,
      labour: approvalTypeSchema,
      expense: approvalTypeSchema,
      payment: approvalTypeSchema,
      subcontract: approvalTypeSchema,
    }),
  }),
});

const updateAccessTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    approvalTypes: z.object({
      material: approvalTypeSchema.partial(),
      labour: approvalTypeSchema.partial(),
      expense: approvalTypeSchema.partial(),
      payment: approvalTypeSchema.partial(),
      subcontract: approvalTypeSchema.partial(),
    }).optional(),
  }),
});

export async function listAccessTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = await AccessTemplate.find().sort({ role: 1 }).lean();
    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

export async function getAccessTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const template = await AccessTemplate.findById(req.params.id).lean();
    if (!template) throw new AppError(404, "Access template not found");
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

export async function getAccessTemplateByRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.params;
    let template = await AccessTemplate.findOne({ role }).lean();
    if (!template) {
      template = await AccessTemplate.findOneAndUpdate(
        { role },
        {
          role,
          name: `${role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} Default`,
          approvalTypes: new Map([
            ["material", { canApprove: false, canReject: false }],
            ["labour", { canApprove: false, canReject: false }],
            ["expense", { canApprove: false, canReject: false }],
            ["payment", { canApprove: false, canReject: false }],
            ["subcontract", { canApprove: false, canReject: false }],
          ]),
        },
        { upsert: true, new: true, lean: true }
      );
    }
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

export async function createAccessTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, role, approvalTypes } = accessTemplateSchema.parse(req.body).body;

    const existing = await AccessTemplate.findOne({ role });
    if (existing) {
      throw new AppError(409, "Access template for this role already exists");
    }

    const template = await AccessTemplate.create({ name, role, approvalTypes });
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
}

export async function updateAccessTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, approvalTypes } = updateAccessTemplateSchema.parse(req.body).body;
    const template = await AccessTemplate.findById(req.params.id);
    if (!template) throw new AppError(404, "Access template not found");

    if (name !== undefined) template.name = name;
    if (approvalTypes) {
      for (const [key, value] of Object.entries(approvalTypes)) {
        const existing = template.approvalTypes.get(key);
        if (existing) {
          template.approvalTypes.set(key, { ...existing, ...value });
        }
      }
    }

    await template.save();
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

export async function deleteAccessTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const template = await AccessTemplate.findByIdAndDelete(req.params.id);
    if (!template) throw new AppError(404, "Access template not found");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}