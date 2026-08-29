import { Types } from "mongoose";
import { Expense } from "../src/models/Expense";
import { GeneralExpense } from "../src/models/GeneralExpense";
import { Material } from "../src/models/Material";
import { SubcontractorPayment } from "../src/models/SubcontractorPayment";
import { projectExpenseOutputRollup } from "../src/services/expense-output-rollup.service";

describe("project expense output rollup", () => {
  afterEach(() => jest.restoreAllMocks());

  it("adds exactly the four outgoing categories", async () => {
    jest.spyOn(Expense, "aggregate").mockResolvedValue([
      { _id: "supervisor", total: 100 },
      { _id: "material", total: 200 },
    ] as never);
    jest.spyOn(GeneralExpense, "aggregate").mockResolvedValue([{ _id: null, total: 300 }] as never);
    jest.spyOn(Material, "aggregate").mockResolvedValue([{ _id: null, total: 50 }] as never);
    jest.spyOn(SubcontractorPayment, "aggregate").mockResolvedValue([{ _id: null, total: 400 }] as never);

    const projectId = new Types.ObjectId().toString();
    await expect(projectExpenseOutputRollup(projectId, null)).resolves.toEqual({
      supervisorExpense: 100,
      materialExpense: 250,
      nonLabourExpense: 300,
      subcontractorPayments: 400,
      totalExpense: 1050,
    });
  });

  it("does not allow a project outside the caller's scope", async () => {
    const projectId = new Types.ObjectId().toString();
    const otherProjectId = new Types.ObjectId();
    const expenseAggregate = jest.spyOn(Expense, "aggregate");

    await expect(projectExpenseOutputRollup(projectId, [otherProjectId])).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(expenseAggregate).not.toHaveBeenCalled();
  });
});
