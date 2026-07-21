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
  // Atomic upsert: returns the existing profile, or creates+returns the default
  // in a single round trip. Avoids the lean() / create() type mismatch and is
  // race-safe under concurrent calls.
  const profile = await CompanyProfile.findOneAndUpdate(
    {},
    { $setOnInsert: DEFAULT_PROFILE },
    {
      new: true,
      upsert: true,
      includeResultMetadata: false,
      setDefaultsOnInsert: true,
    },
  ).lean();
  return profile;
}

export async function saveCompanyProfile(patch: Partial<typeof DEFAULT_PROFILE>) {
  const updated = await CompanyProfile.findOneAndUpdate(
    {},
    { $set: patch },
    { new: true, runValidators: true, upsert: true, includeResultMetadata: false },
  ).lean();
  return updated;
}
