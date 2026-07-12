import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import * as authService from "../services/auth.service.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { AccessTemplate } from "../models/AccessTemplate.js";
import { AccessSchedule } from "../models/AccessSchedule.js";
import { User } from "../models/User.js";
import { ActivityLog } from "../models/ActivityLog.js";

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
});

const accessTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    role: z.enum(["admin", "project_manager", "accountant", "supervisor"]),
    approvalTypes: z.object({
      material: approvalTypeSchema,
      labour: approvalTypeSchema,
      attendance: approvalTypeSchema,
      site_expense: approvalTypeSchema,
      general_expense: approvalTypeSchema,
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
      attendance: approvalTypeSchema.partial(),
      site_expense: approvalTypeSchema.partial(),
      general_expense: approvalTypeSchema.partial(),
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
          approvalTypes: {
            material: { canApprove: false, canReject: false },
            labour: { canApprove: false, canReject: false },
            expense: { canApprove: false, canReject: false },
            payment: { canApprove: false, canReject: false },
            subcontract: { canApprove: false, canReject: false },
          },
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
        (template.approvalTypes as any)[key] = {
          ...(template.approvalTypes as any)[key] || {},
          ...value,
        };
      }
    }

    await template.save();
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

const updateAccessTemplateByRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    approvalTypes: z.object({
      material: z.object({ canApprove: z.boolean() }).partial().optional(),
      labour: z.object({ canApprove: z.boolean() }).partial().optional(),
      attendance: z.object({ canApprove: z.boolean() }).partial().optional(),
      site_expense: z.object({ canApprove: z.boolean() }).partial().optional(),
      general_expense: z.object({ canApprove: z.boolean() }).partial().optional(),
      payment: z.object({ canApprove: z.boolean() }).partial().optional(),
      subcontract: z.object({ canApprove: z.boolean() }).partial().optional(),
    }).optional(),
  }),
});

export async function updateAccessTemplateByRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.params;
    const { name, approvalTypes } = updateAccessTemplateByRoleSchema.parse(req.body).body;

    const template = await AccessTemplate.findOneAndUpdate(
      { role },
      {
        ...(name && { name }),
        ...(approvalTypes && {
          approvalTypes: {
            material: { canApprove: approvalTypes.material?.canApprove ?? false },
            labour: { canApprove: approvalTypes.labour?.canApprove ?? false },
            attendance: { canApprove: approvalTypes.attendance?.canApprove ?? false },
            site_expense: { canApprove: approvalTypes.site_expense?.canApprove ?? false },
            general_expense: { canApprove: approvalTypes.general_expense?.canApprove ?? false },
            payment: { canApprove: approvalTypes.payment?.canApprove ?? false },
            subcontract: { canApprove: approvalTypes.subcontract?.canApprove ?? false },
          },
        }),
      },
      { new: true, runValidators: true, upsert: true }
    ).lean();

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

export async function listAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select("_id name email phone role status managedProjectIds createdAt lastLoginAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    res.json({
      items: users,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.params.id)
      .select("_id name email phone role status managedProjectIds createdAt lastLoginAt requestPermissions")
      .lean();
    if (!user) throw new AppError(404, "User not found");
    res.json({ employee: user });
  } catch (err) {
    next(err);
  }
}

export async function getUserRequestPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.params.id).select("requestPermissions").lean();
    if (!user) throw new AppError(404, "User not found");
    res.json({
      canApproveMaterial: user.requestPermissions?.canApproveMaterial ?? false,
      canApproveLabour: user.requestPermissions?.canApproveLabour ?? false,
      canApproveExpense: user.requestPermissions?.canApproveExpense ?? false,
      canApproveGeneral: user.requestPermissions?.canApproveGeneral ?? false,
      canApproveSubcontract: user.requestPermissions?.canApproveSubcontract ?? false,
      canApprovePayment: user.requestPermissions?.canApprovePayment ?? false,
      canManageWorkers: user.requestPermissions?.canManageWorkers ?? false,
      canViewReports: user.requestPermissions?.canViewReports ?? false,
    });
  } catch (err) {
    next(err);
  }
}

export async function saveUserRequestPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { canApproveMaterial, canApproveLabour, canApproveExpense, canApproveGeneral, canApproveSubcontract, canApprovePayment, canManageWorkers, canViewReports } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        requestPermissions: {
          canApproveMaterial: !!canApproveMaterial,
          canApproveLabour: !!canApproveLabour,
          canApproveExpense: !!canApproveExpense,
          canApproveGeneral: !!canApproveGeneral,
          canApproveSubcontract: !!canApproveSubcontract,
          canApprovePayment: !!canApprovePayment,
          canManageWorkers: !!canManageWorkers,
          canViewReports: !!canViewReports,
        },
      },
      { new: true, runValidators: true }
    ).select("requestPermissions").lean();
    if (!user) throw new AppError(404, "User not found");

    if (req.user?.sub) {
      await ActivityLog.create({
        userId: new Types.ObjectId(req.user.sub),
        action: "permission_updated",
        description: `Updated permissions for user ${req.params.id}`,
        metadata: { targetUserId: req.params.id, permissions: req.body },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch(() => {});
    }

    res.json({ success: true, requestPermissions: user.requestPermissions });
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.id;
    const days = Number(req.query.days) || 30;
    const limit = Number(req.query.limit) || 50;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const logs = await ActivityLog.find({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      activity: logs.map((log) => ({
        id: log._id.toString(),
        action: log.action,
        description: log.description,
        timestamp: log.createdAt.toISOString(),
        metadata: log.metadata,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getAccessSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let schedule = await AccessSchedule.findOne().lean();
    if (!schedule) {
      const created = await AccessSchedule.create({
        enabled: false,
        windows: [],
      });
      res.json({
        enabled: false,
        windows: [],
      });
      return;
    }
    res.json({
      enabled: schedule.enabled,
      windows: schedule.windows,
    });
  } catch (err) {
    next(err);
  }
}

export async function saveAccessSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { enabled, windows } = req.body;
    const schedule = await AccessSchedule.findOneAndUpdate(
      {},
      { enabled, windows, updatedAt: new Date() },
      { upsert: true, new: true, lean: true }
    );
    res.json({ success: true, schedule });
  } catch (err) {
    next(err);
  }
}

export async function getAccessScheduleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const schedule = await AccessSchedule.findOne().lean();
    if (!schedule || !schedule.enabled) {
      res.json({ isRestricted: false });
      return;
    }

    const now = new Date();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = dayNames[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const window of schedule.windows) {
      if (!window.isActive) continue;
      if (!window.days.includes(currentDay)) continue;

      const [sh, sm] = window.startTime.split(":").map(Number);
      const [eh, em] = window.endTime.split(":").map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      let isWithin = false;
      if (startMinutes < endMinutes) {
        isWithin = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        isWithin = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      if (isWithin) {
        res.json({
          isRestricted: true,
          currentWindow: {
            id: window.id,
            startTime: window.startTime,
            endTime: window.endTime,
            reason: window.note || "Access restricted during scheduled window",
          },
        });
        return;
      }
    }

    res.json({ isRestricted: false });
  } catch (err) {
    next(err);
  }
}

export async function getAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { RefreshToken } = await import("../models/RefreshToken.js");
    const sessions = await RefreshToken.find({
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        device: s.userAgent || "Unknown",
        ip: s.ip || "Unknown",
        location: (s.userId as any)?.name || "Unknown User",
        userEmail: (s.userId as any)?.email || "",
        userRole: (s.userId as any)?.role || "",
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.userId?.toString() === req.user?.sub,
        lastActiveAt: s.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}