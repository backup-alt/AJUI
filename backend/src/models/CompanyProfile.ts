import { Schema, model, Document } from "mongoose";

export interface ICompanyProfile extends Document {
  name: string;
  address: string;
  state: string;
  gstin: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
}

const companyProfileSchema = new Schema<ICompanyProfile>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    state: { type: String, default: "Tamil Nadu" },
    gstin: { type: String, default: "", trim: true },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    branch: { type: String, default: "" },
  },
  { timestamps: true }
);

export const CompanyProfile = model<ICompanyProfile>("CompanyProfile", companyProfileSchema);
