import request from "supertest";
import { app } from "./setup";
import { User } from "../src/models/User";
import { InviteToken } from "../src/models/InviteToken";

let token = "";

const loginAndGetToken = async () => {
  const res = await request(app).post("/api/auth/login").send({
    phone: "+919999999999",
    password: "TestPass123",
  });
  return res.body.accessToken;
};

describe("Employee invite signup flow", () => {
  beforeAll(async () => {
    if (!app) return;
    token = await loginAndGetToken();
  });

  beforeEach(async () => {
    if (!app) return;
    await InviteToken.deleteMany({});
    await User.deleteMany({ email: { $ne: "admin@test.com" } });
  });

  it("employeeSignup works with phone provided", async () => {
    if (!app) return;
    const inv = await request(app)
      .post("/api/admin/invites/employee")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "PM", email: "pm@test.com", phone: "1234567890", role: "project_manager" });
    expect(inv.status).toBe(201);

    const res = await request(app)
      .post("/api/auth/employee/signup")
      .send({ token: inv.body.token, name: "PM", phone: "1234567890", password: "Test@123" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("project_manager");
  });

  it("employeeSignup works without phone (no otpHash)", async () => {
    if (!app) return;
    const inv = await request(app)
      .post("/api/admin/invites/employee")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "PM2", email: "pm2@test.com", role: "project_manager" });
    expect(inv.status).toBe(201);

    const res = await request(app)
      .post("/api/auth/employee/signup")
      .send({ token: inv.body.token, name: "PM2", password: "Test@123" });
    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe("pm2@test.com");
  });

  it("employeeSignup succeeds even after resendOtp sets otpHash", async () => {
    if (!app) return;
    const inv = await request(app)
      .post("/api/admin/invites/employee")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "PM3", email: "pm3@test.com", role: "accountant" });
    expect(inv.status).toBe(201);
    const inviteToken = inv.body.token;

    await request(app)
      .post("/api/auth/employee/resend-otp")
      .send({ token: inviteToken });
    const inviteAfter = await InviteToken.findOne({ token: inviteToken }).lean();
    expect(inviteAfter?.otpHash).toBeTruthy();

    const res = await request(app)
      .post("/api/auth/employee/signup")
      .send({ token: inviteToken, name: "PM3", password: "Test@123" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("accountant");
  });

  it("verifyEmployeeOtp completes signup without phone (no dummy-phone collision)", async () => {
    if (!app) return;
    const inv = await request(app)
      .post("/api/admin/invites/employee")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "PM4", email: "pm4@test.com", role: "project_manager" });
    expect(inv.status).toBe(201);
    const inviteToken = inv.body.token;

    const resend = await request(app)
      .post("/api/auth/employee/resend-otp")
      .send({ token: inviteToken });
    expect(resend.status).toBe(200);
    const otp = resend.body.otp;

    const res = await request(app)
      .post("/api/auth/employee/verify-otp")
      .send({ token: inviteToken, otp, password: "Test@123" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("project_manager");
    expect(res.body.user.phone).toBe("pm4@test.com");
  });

  it("employeeSignup fails cleanly (non-500) when invite is already used", async () => {
    if (!app) return;
    const inv = await request(app)
      .post("/api/admin/invites/employee")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Used", email: "used@test.com", phone: "1234567890", role: "project_manager" });
    expect(inv.status).toBe(201);

    const first = await request(app)
      .post("/api/auth/employee/signup")
      .send({ token: inv.body.token, name: "Used", phone: "1234567890", password: "Test@123" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/auth/employee/signup")
      .send({ token: inv.body.token, name: "Used", phone: "1234567890", password: "Test@123" });
    expect(second.status).toBe(410);
    expect(second.body.error).toBeTruthy();
  });
});
