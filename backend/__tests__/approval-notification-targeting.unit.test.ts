import { Types } from "mongoose";
import { Approval } from "../src/models/Approval";
import { Expense } from "../src/models/Expense";
import { approveRequest, rejectRequest } from "../src/services/approval.service";
import { notifyProjectSupervisors, notifyUserOfApproval } from "../src/services/device-token.service";

// Mock the entire Approval model to prevent database connection
jest.mock("../src/models/Approval", () => ({
  Approval: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

// Mock the entire Expense model to prevent database connection
jest.mock("../src/models/Expense", () => ({
  Expense: {
    findById: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock("../src/services/device-token.service", () => ({
  notifyUserOfApproval: jest.fn().mockResolvedValue(1),
  notifyProjectSupervisors: jest.fn().mockResolvedValue(1),
}));

const ownerId = new Types.ObjectId().toString();

function approvalRecord() {
  const record: any = {
    approvalId: "APR-PRIVATE-1",
    type: "expense",
    title: "Expense request",
    sourceCollection: "expenses",
    sourceId: new Types.ObjectId(),
    owner: ownerId,
    amount: 500,
    status: "Pending",
    save: jest.fn().mockResolvedValue(undefined),
  };
  record.toObject = jest.fn(() => record);
  return record;
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("approval notification privacy", () => {
  it("sends an approval result only to the supervisor who submitted it", async () => {
    const approval = approvalRecord();
    (Approval.findOne as jest.Mock).mockResolvedValue(approval);
    (Approval.findOneAndUpdate as jest.Mock).mockResolvedValue(approval);
    (Expense.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({}) } as any);
    (Expense.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true } as any);

    await approveRequest(approval.approvalId, new Types.ObjectId().toString());

    expect(notifyUserOfApproval).toHaveBeenCalledTimes(1);
    expect(notifyUserOfApproval).toHaveBeenCalledWith(ownerId, expect.any(String), expect.any(String), expect.objectContaining({ status: "Approved" }));
    expect(notifyProjectSupervisors).not.toHaveBeenCalled();
  });

  it("sends a rejection result only to the supervisor who submitted it", async () => {
    const approval = approvalRecord();
    (Approval.findOne as jest.Mock).mockResolvedValue(approval);
    (Approval.findOneAndUpdate as jest.Mock).mockResolvedValue(approval);
    (Expense.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true } as any);

    await rejectRequest(approval.approvalId, new Types.ObjectId().toString());

    expect(notifyUserOfApproval).toHaveBeenCalledTimes(1);
    expect(notifyUserOfApproval).toHaveBeenCalledWith(ownerId, expect.any(String), expect.any(String), expect.objectContaining({ status: "Rejected" }));
    expect(notifyProjectSupervisors).not.toHaveBeenCalled();
  });
});
