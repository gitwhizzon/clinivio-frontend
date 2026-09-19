"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth.store";

const WS_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "https://api.megnim.com") + "/appointments";

/**
 * Connects to the appointment status WebSocket namespace.
 * Automatically subscribes to the patient's tenant room and invalidates
 * the "appointments" query when a status update arrives.
 *
 * Auth: the httpOnly patientAccessToken cookie rides along automatically on
 * the WS upgrade request for same-site connections (production megnim.com,
 * local dev) — the gateway verifies it server-side and scopes the room to
 * that token's own tenantId, so nothing sensitive needs to be readable here.
 */
export function useAppointmentSocket() {
  const { patient, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !patient?.tenantId) return;

    const socket = io(WS_URL, {
      transports: ["websocket"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe");
    });

    socket.on("appointment:statusUpdate", (payload: { id: string; status: string }) => {
      // Optimistically invalidate the appointments query to refetch with new status
      qc.invalidateQueries({ queryKey: ["appointments"] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, patient?.tenantId, qc]);
}
