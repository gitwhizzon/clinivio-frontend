"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PatientUser {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  tenantId: string;
}

interface AuthState {
  tenantId: string | null;
  patient: PatientUser | null;
  isAuthenticated: boolean;
  // The access token is an httpOnly cookie (patientAccessToken) now, set by
  // the backend — never stored here, never readable by JS.
  setAuth: (patient: PatientUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tenantId: null,
      patient: null,
      isAuthenticated: false,
      setAuth: (patient) =>
        set({ patient, tenantId: patient.tenantId, isAuthenticated: true }),
      clearAuth: () =>
        set({ patient: null, tenantId: null, isAuthenticated: false }),
    }),
    { name: "clinivio-patient-auth" },
  ),
);
