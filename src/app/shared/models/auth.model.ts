export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'project_manager' | 'accountant' | 'supervisor' | 'client';
  status: 'active' | 'inactive' | 'pending';
  managedProjectIds?: string[];
  supervisorProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupervisorProfile {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  projectIds: string[];
  siteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface QRInvitePayload {
  token: string;
  type?: 'supervisor';
  projectId?: string;
  siteIds?: string[];
  supervisorName?: string;
  supervisorPhone?: string;
  supervisorEmail?: string;
  expiresAt?: string;
}

export interface VerifyInviteResponse {
  valid: boolean;
  requiresOtp: boolean;
  role: string;
  projectId?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  supervisorPhone?: string;
  expiresAt: string;
}

export interface SignupRequest {
  token: string;
  otp: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}
