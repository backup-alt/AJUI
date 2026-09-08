import express from "express";
import request from "supertest";
import { InboxMessage } from "../src/models/InboxMessage";
import inboxRoutes from "../src/routes/inbox.routes";
import { createExpenseMobileSchema } from "../src/schemas/mobile.schema";
import { fundSupervisorSchema } from "../src/schemas/entities.schema";
import { receivedRemainingStock } from "../src/services/inventory.service";

jest.mock("../src/middleware/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { sub: "111111111111111111111111", role: req.headers["x-role"] || "project_manager" };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use("/inbox", inboxRoutes);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({error: error.message}));
afterEach(() => jest.restoreAllMocks());

describe("Private inbox permissions", () => {
  it("scopes a manager's messages to their own conversation", async () => {
    const query = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    const find = jest.spyOn(InboxMessage, "find").mockReturnValue(query as any);
    expect((await request(app).get("/inbox")).status).toBe(200);
    expect(find).toHaveBeenCalledWith({ownerId: "111111111111111111111111"});
  });
  it("does not allow a manager to edit another sender's message", async () => {
    const update = jest.spyOn(InboxMessage, "findOneAndUpdate").mockResolvedValue(null);
    expect((await request(app).patch("/inbox/222222222222222222222222").send({text: "changed"})).status).toBe(404);
    expect(update.mock.calls[0][0]).toEqual({_id: "222222222222222222222222", senderId: "111111111111111111111111", ownerId: "111111111111111111111111"});
  });
  it("denies managers deletion and the admin activity feed", async () => {
    expect((await request(app).delete("/inbox/222222222222222222222222")).status).toBe(403);
    expect((await request(app).get("/inbox/activity")).status).toBe(403);
  });
  it("allows admin access to all conversations", async () => {
    const query = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    const find = jest.spyOn(InboxMessage, "find").mockReturnValue(query as any);
    expect((await request(app).get("/inbox").set("x-role", "admin")).status).toBe(200);
    expect(find).toHaveBeenCalledWith({});
  });
});

describe("Purchase and expense validation", () => {
  const purchase = {transactionType: "Purchase", amount: 100, date: "2026-09-07", description: "Fuel", paymentMode: "UPI"};
  it("requires a bill before a mobile purchase can enter approvals", () => {
    expect(createExpenseMobileSchema.safeParse({body: purchase}).success).toBe(false);
    expect(createExpenseMobileSchema.safeParse({body: {...purchase, bill: {data: "a".repeat(30), mimeType: "application/pdf", fileName: "bill.pdf"}}}).success).toBe(true);
  });
  it("requires a payment mode for funding and mobile expenses", () => {
    expect(createExpenseMobileSchema.safeParse({body: {...purchase, transactionType: "Cash Added", paymentMode: ""}}).success).toBe(false);
    expect(fundSupervisorSchema.safeParse({params: {id: "111111111111111111111111"}, body: {projectId: "222222222222222222222222", amount: 100}}).success).toBe(false);
  });
  it("makes all purchased stock available, regardless of legacy receipt status", () => {
    expect(receivedRemainingStock({purchasedQuantity: 25, consumedQuantity: 8, received: false, purchaseHistory: []})).toBe(17);
    expect(receivedRemainingStock({purchasedQuantity: 5, consumedQuantity: 8, received: false, purchaseHistory: []})).toBe(0);
  });
});
