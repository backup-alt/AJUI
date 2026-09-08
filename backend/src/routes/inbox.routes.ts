import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { InboxMessage } from "../models/InboxMessage.js";
import { User } from "../models/User.js";
import { Expense } from "../models/Expense.js";
import { Material } from "../models/Material.js";
import { SubcontractorPayment } from "../models/SubcontractorPayment.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";
import { Site } from "../models/Site.js";
import { GeneralExpense } from "../models/GeneralExpense.js";
import { Project } from "../models/Project.js";

const router = Router();
router.use(requireAuth);
const input = z.object({
  text: z.string().trim().min(1).max(4000),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  link: z.string().trim().max(1000).refine((value) => value.startsWith("/"), "Message links must stay inside the application").optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const filter = req.user!.role === "admin" ? {} : { ownerId: req.user!.sub };
    const page = Math.max(1, Number(req.query.page) || 1);
    const rows = await InboxMessage.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(11).lean();
    res.json({ items: rows.slice(0, 10), page, hasMore: rows.length > 10 });
  } catch (error) { next(error); }
});
router.post("/", async (req, res, next) => {
  try {
    const parsed = input.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "Enter a message of up to 4000 characters and a valid recipient");
    const ownerId = req.user!.role === "admin" ? parsed.data.ownerId : req.user!.sub;
    if (!ownerId) throw new AppError(400, "Choose a conversation to reply to");
    const [owner, sender] = await Promise.all([User.findById(ownerId).select("name"), User.findById(req.user!.sub).select("name")]);
    if (!owner || !sender) throw new AppError(404, "User not found");
    const message = await InboxMessage.create({ ownerId, senderId: req.user!.sub, senderName: sender.name, text: parsed.data.text, link: parsed.data.link });
    res.status(201).json({ message });
  } catch (error) { next(error); }
});
router.get("/recipients", requireAdmin, async (_req, res, next) => {
  try {
    const items = await User.find({ role: { $ne: "admin" }, status: { $ne: "inactive" } }).select("_id name email role").sort({ name: 1 }).lean();
    res.json({ items });
  } catch (error) { next(error); }
});
router.get("/activity", requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const sourceLimit = page * 10 + 1;
    // Read persisted transactions so edits and deletions are reflected immediately.
    const [expenses, materials, payments, orders, sites, general] = await Promise.all([
      Expense.find().sort({ updatedAt: -1 }).limit(sourceLimit).lean(),
      Material.find({ givenAmount: { $gt: 0 } }).sort({ updatedAt: -1 }).limit(sourceLimit).lean(),
      SubcontractorPayment.find().sort({ updatedAt: -1 }).limit(sourceLimit).lean(),
      PurchaseOrder.find({ deletedAt: { $exists: false } }).sort({ updatedAt: -1 }).limit(sourceLimit).lean(),
      Site.find({ openingBalance: { $gt: 0 } }).sort({ updatedAt: -1 }).limit(sourceLimit).lean(),
      GeneralExpense.find().sort({ updatedAt: -1 }).limit(sourceLimit).lean(),
    ]);
    const siteProjects = await Project.find({ _id: { $in: sites.flatMap(site => site.openingProjectId ? [site.openingProjectId] : site.projectIds) } }).select("name").lean();
    const projectNames = new Map(siteProjects.map(project => [String(project._id), project.name]));
    const items = [
      ...sites.map(row => ({ id: `opening:${row._id}`, project: projectNames.get(String(row.openingProjectId || row.projectIds[0])) || row.name, actor: row.openingFundedBy || row.supervisor, action: "Opening supervisor funding", description: row.openingDescription || "Opening balance", amount: row.openingBalance, paymentMode: row.openingPaymentMode, date: row.openingFundedAt || row.updatedAt })),
      ...general.map(row => ({ id: `general:${row._id}`, project: row.projectName, actor: row.createdBy, action: "Project expense", description: row.description, amount: row.amount, paymentMode: row.paymentMode, billUrl: row.billUrl, status: row.status, date: row.updatedAt })),
      ...expenses.map(row => ({ id: `expense:${row._id}`, project: row.projectName, actor: row.transactionType === "Cash Added" ? row.submittedBy : row.supervisor || row.submittedBy, action: row.transactionType === "Cash Added" ? "Supervisor funding" : "Supervisor expense request", description: row.description, amount: row.amount, paymentMode: row.paymentMode, billUrl: row.billUrl, status: row.status, date: row.updatedAt })),
      ...materials.map(row => ({ id: `material:${row._id}`, project: row.projectName, actor: row.createdBy, action: "Vendor payment", description: `${row.vendor || "Vendor"} — ${row.name}`, amount: row.givenAmount, paymentMode: row.paymentType, date: row.updatedAt })),
      ...payments.map(row => ({ id: `subcontractor:${row._id}`, project: row.projectName, actor: String(row.createdBy || ""), action: "Subcontractor payment", description: row.subcontractorName, amount: row.amount, paymentMode: row.paymentType, date: row.updatedAt })),
      ...orders.map(row => ({ id: `po:${row._id}`, project: row.projectName, actor: String(row.createdBy || ""), action: "Material purchase", description: `${row.poNumber} — ${row.vendorName}: ${row.items.map(item => `${item.description} ${item.quantity} ${item.unit}`).join(", ")}`, amount: row.grandTotal, paymentMode: row.paymentMode, date: row.updatedAt })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const actorIds = [...new Set(items.map(item => String(item.actor || "")).filter(id => /^[a-f\d]{24}$/i.test(id)))];
    const actors = actorIds.length ? await User.find({ _id: { $in: actorIds } }).select("name").lean() : [];
    const names = new Map(actors.map(actor => [String(actor._id), actor.name]));
    const start = (page - 1) * 10;
    const pageItems = items.slice(start, start + 10);
    res.json({
      items: pageItems.map(item => ({...item, actor: names.get(String(item.actor)) || item.actor || "Office"})),
      page,
      hasMore: items.length > start + 10,
    });
  } catch (error) { next(error); }
});
export default router;
