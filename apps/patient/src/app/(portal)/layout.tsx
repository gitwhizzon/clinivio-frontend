"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Calendar, FlaskConical, FileText,
  CreditCard, User, LogOut, HeartPulse, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { getInitials } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",      label: "Dashboard",      icon: LayoutDashboard },
  { href: "/appointments",   label: "Appointments",   icon: Calendar },
  { href: "/consultations",  label: "Consultations",  icon: FileText },
  { href: "/lab-results",    label: "Lab Results",    icon: FlaskConical },
  { href: "/invoices",       label: "Bills",          icon: CreditCard },
  { href: "/profile",        label: "My Profile",     icon: User },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, patient, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={cn(
      "flex flex-col h-full bg-white border-r",
      mobile ? "w-64" : "w-64 hidden lg:flex",
    )}>
      <div className="flex items-center gap-2 px-5 py-4 border-b">
        <HeartPulse className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg text-primary">Megnim</span>
      </div>

      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {getInitials(patient?.firstName, patient?.lastName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{patient?.firstName} {patient?.lastName ?? ""}</p>
            <p className="text-xs text-muted-foreground">UHID: {patient?.uhid}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-primary/10 text-primary"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
          <button onClick={() => setSidebarOpen(true)} className="p-1 rounded-md hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <HeartPulse className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">Megnim Health</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
