import { Types } from "mongoose";
import { Attendance } from "../models/Attendance.js";
import { Worker } from "../models/Worker.js";
import { AppError } from "../middleware/errorHandler.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

export interface GroupedAttendance {
  date: string;
  shift: number;
  paymentMode: string;
  site?: string;
  subcontractorName?: string;
  labourType?: string;
  workers: Array<{
    workerId: string;
    workerName: string;
    shiftCount: number;
    overtimeHours: number;
    overtimeAmount: number;
    lateFine: number;
    dailyPay: number;
  }>;
  totalWorkers: number;
  totalDailyPay: number;
}

export async function listGroupedAttendance(filter: {
  projectId: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  scopeProjectIds?: ProjectScopeIds;
}): Promise<{ items: GroupedAttendance[]; total: number }> {
  const match: Record<string, unknown> = {};
  if (filter.projectId) match.projectId = new Types.ObjectId(filter.projectId);
  if (filter.from || filter.to) {
    match.date = {};
    if (filter.from) (match.date as Record<string, string>).$gte = filter.from;
    if (filter.to) (match.date as Record<string, string>).$lte = filter.to;
  }
  applyProjectScope(match, "projectId", filter.scopeProjectIds);

  const skip = (filter.page - 1) * filter.limit;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "workers",
        localField: "workerId",
        foreignField: "_id",
        as: "worker",
      },
    },
    { $unwind: { path: "$worker", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          date: "$date",
          shift: "$shift",
          paymentMode: "$paymentMode",
          site: "$site",
          subcontractorName: "$subcontractorName",
          labourType: "$worker.labourType",
        },
        workers: {
          $push: {
            workerId: { $toString: "$workerId" },
            workerName: "$worker.name",
            shiftCount: "$shiftCount",
            overtimeHours: "$overtimeHours",
            overtimeAmount: "$overtimeAmount",
            lateFine: "$lateFine",
          },
        },
        totalWorkers: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": -1, "_id.shift": 1 } },
    { $skip: skip },
    { $limit: filter.limit },
  ];

  const [results, countResult] = await Promise.all([
    Attendance.aggregate(pipeline as any),
    Attendance.aggregate([{ $match: match as any }, { $count: "total" }]),
  ]);

  const total = countResult.length > 0 ? countResult[0].total : 0;

  const items: GroupedAttendance[] = results.map((r) => {
    const weeklyPay = r.workers[0]?.weeklyPay || 0;
    const shiftMultiplier = r._id.shift === 1 ? 0.5 : 1;
    const dailyPay = (weeklyPay / 7) * shiftMultiplier;

    return {
      date: r._id.date,
      shift: r._id.shift,
      paymentMode: r._id.paymentMode,
      site: r._id.site,
      subcontractorName: r._id.subcontractorName,
      labourType: r._id.labourType,
      workers: r.workers.map((w: any) => ({
        ...w,
        dailyPay: w.shiftCount * dailyPay - w.lateFine + w.overtimeAmount,
      })),
      totalWorkers: r.totalWorkers,
      totalDailyPay: r.workers.reduce(
        (sum: number, w: any) => sum + w.dailyPay,
        0
      ),
    };
  });

  return { items, total };
}

export async function getLabourReport(filter: {
  projectId: string;
  from?: string;
  to?: string;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const match: Record<string, unknown> = {};
  if (filter.projectId) match.projectId = new Types.ObjectId(filter.projectId);
  if (filter.from || filter.to) {
    match.date = {};
    if (filter.from) (match.date as Record<string, string>).$gte = filter.from;
    if (filter.to) (match.date as Record<string, string>).$lte = filter.to;
  }
  applyProjectScope(match, "projectId", filter.scopeProjectIds);

  const results = await Attendance.aggregate([
    { $match: match as any },
    {
      $lookup: {
        from: "workers",
        localField: "workerId",
        foreignField: "_id",
        as: "worker",
      },
    },
    { $unwind: { path: "$worker", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          date: "$date",
          shift: "$shift",
          paymentMode: "$paymentMode",
          subcontractorName: "$subcontractorName",
          labourType: "$worker.labourType",
        },
        workers: {
          $push: {
            workerId: { $toString: "$workerId" },
            workerName: "$worker.name",
            weeklyPay: "$worker.weeklyPay",
            shiftCount: "$shiftCount",
            overtimeHours: "$overtimeHours",
            overtimeAmount: "$overtimeAmount",
            lateFine: "$lateFine",
          },
        },
        totalWorkers: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1, "_id.shift": 1 } },
  ] as any);

  const subtotalsByWeek: Record<string, any> = {};
  const grandTotal = { totalWorkers: 0, totalDailyPay: 0 };

  const report = results.map((r) => {
    const weekStart = getMonday(r._id.date);
    if (!subtotalsByWeek[weekStart]) {
      subtotalsByWeek[weekStart] = { weekStart, totalWorkers: 0, totalDailyPay: 0, groups: [] };
    }

    let groupDailyPay = 0;
    const workers = r.workers.map((w: any) => {
      const weeklyPay = w.weeklyPay || 0;
      const shiftMultiplier = r._id.shift === 1 ? 0.5 : 1;
      const baseDaily = weeklyPay / 7;
      const dailyPay = w.shiftCount * baseDaily * shiftMultiplier - w.lateFine + w.overtimeAmount;
      groupDailyPay += dailyPay;
      return { ...w, dailyPay: Math.round(dailyPay * 100) / 100 };
    });

    const group = {
      date: r._id.date,
      shift: r._id.shift,
      paymentMode: r._id.paymentMode,
      subcontractorName: r._id.subcontractorName,
      labourType: r._id.labourType,
      workers,
      totalWorkers: r.totalWorkers,
      totalDailyPay: Math.round(groupDailyPay * 100) / 100,
    };

    subtotalsByWeek[weekStart].totalWorkers += r.totalWorkers;
    subtotalsByWeek[weekStart].totalDailyPay += groupDailyPay;
    subtotalsByWeek[weekStart].groups.push(group);

    grandTotal.totalWorkers += r.totalWorkers;
    grandTotal.totalDailyPay += groupDailyPay;

    return group;
  });

  const weeklySummaries = Object.values(subtotalsByWeek).map((w: any) => ({
    ...w,
    totalDailyPay: Math.round(w.totalDailyPay * 100) / 100,
  }));

  return {
    items: report,
    weeklySummaries,
    grandTotal: {
      totalWorkers: grandTotal.totalWorkers,
      totalDailyPay: Math.round(grandTotal.totalDailyPay * 100) / 100,
    },
  };
}

function getMonday(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}