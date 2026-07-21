import { CompanyProfile } from "../models/CompanyProfile.js";

const DEFAULT_PROFILE = {
  name: "Annai Golden Builders",
  address: "",
  state: "Tamil Nadu",
  gstin: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  branch: "",
};

export async function getCompanyProfile() {
  let profile = await CompanyProfile.findOne().lean();
  if (!profile) {
    await CompanyProfile.create(DEFAULT_PROFILE);
    profile = await CompanyProfile.findOne().lean();
  }
  return profile;
}

export async function saveCompanyProfile(patch: Partial<typeof DEFAULT_PROFILE>) {
  const updated = await CompanyProfile.findOneAndUpdate(
    {},
    { $set: patch },
    { new: true, runValidators: true, upsert: true }
  ).lean();
  return updated;
}
