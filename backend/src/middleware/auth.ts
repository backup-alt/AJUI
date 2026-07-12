import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../utils/jwt.js";
import { AccessSchedule } from "../models/AccessSchedule.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

function getISTMinutes(): number {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + 330) % (24 * 60);
}

function getISTDayIndex(): number {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dayOffset = Math.floor((utcMinutes + 330) / (24 * 60));
  return (now.getUTCDay() + dayOffset) % 7;
}

export async function checkAccessSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next();
    return;
  }
  if (req.user.role === "admin") {
    next();
    return;
  }
  try {
    const schedule = await AccessSchedule.findOne().lean();
    if (!schedule || !schedule.enabled) {
      next();
      return;
    }
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = dayNames[getISTDayIndex()];
    const currentMinutes = getISTMinutes();
    for (const window of schedule.windows) {
      if (!window.isActive) continue;
      if (!window.days.includes(currentDay)) continue;
      if (window.appliesTo.length > 0 && !window.appliesTo.includes(req.user.role)) continue;
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
        res.status(403).json({ error: "Access timing is over. Contact admin if you need access.", code: "ACCESS_SCHEDULE_RESTRICTED" });
        return;
      }
    }
    next();
  } catch {
    next();
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;

    if (req.user.role !== "admin") {
      const schedule = await AccessSchedule.findOne().lean();
      if (schedule && schedule.enabled) {
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const utcMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
        const istMinutes = (utcMinutes + 330) % (24 * 60);
        const dayOffset = Math.floor((utcMinutes + 330) / (24 * 60));
        const currentDayIndex = (new Date().getUTCDay() + dayOffset) % 7;
        const currentDay = dayNames[currentDayIndex];

        for (const window of schedule.windows) {
          if (!window.isActive) continue;
          if (!window.days.includes(currentDay)) continue;
          if (window.appliesTo.length > 0 && !window.appliesTo.includes(req.user.role)) continue;

          const [sh, sm] = window.startTime.split(":").map(Number);
          const [eh, em] = window.endTime.split(":").map(Number);
          const startMinutes = sh * 60 + sm;
          const endMinutes = eh * 60 + em;

          let isWithin = false;
          if (startMinutes < endMinutes) {
            isWithin = istMinutes >= startMinutes && istMinutes < endMinutes;
          } else {
            isWithin = istMinutes >= startMinutes || istMinutes < endMinutes;
          }

          if (isWithin) {
            res.status(403).json({ error: "Access timing is over. Contact admin if you need access.", code: "ACCESS_SCHEDULE_RESTRICTED" });
            return;
          }
        }
      }
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      req.user = verifyAccessToken(header.slice(7));
    } catch {
      // ignore
    }
  }
  next();
}
