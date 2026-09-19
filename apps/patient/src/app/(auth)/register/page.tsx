"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { useAuthStore } from "@/store/auth.store";
import api from "@/lib/api";

const schema = z.object({
  slug:      z.string().min(1, "Hospital ID is required"),
  phone:     z.string().min(10, "Enter a valid phone number"),
  password:  z.string().min(8, "Min 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName:  z.string().optional(),
  email:     z.string().email("Invalid email").optional().or(z.literal("")),
  dob:       z.string().optional(),
  uhid:      z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [linkExisting, setLinkExisting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const payload = { ...data, email: data.email || undefined };
      const res = await api.post("/patient-portal/auth/register", payload);
      setAuth(res.data.patient);
      toast({ title: "Account created!", description: "Welcome to your health portal.", variant: "success" });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err?.response?.data?.message ?? "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <HeartPulse className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Access your health records anytime</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hospital ID <span className="text-destructive">*</span></label>
              <input {...register("slug")} placeholder="e.g. city-hospital"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.slug && <p className="mt-1 text-xs text-destructive">{errors.slug.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">First Name <span className="text-destructive">*</span></label>
                <input {...register("firstName")} placeholder="Ravi"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input {...register("lastName")} placeholder="Kumar"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Phone <span className="text-destructive">*</span></label>
              <input {...register("phone")} placeholder="+919876543210"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password <span className="text-destructive">*</span></label>
              <input {...register("password")} type="password" placeholder="Min 8 characters"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input {...register("email")} type="email" placeholder="ravi@email.com"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input {...register("dob")} type="date"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="link-existing" checked={linkExisting}
                onChange={(e) => setLinkExisting(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary" />
              <label htmlFor="link-existing" className="text-sm text-muted-foreground cursor-pointer">
                I already have a UHID (link to existing patient record)
              </label>
            </div>

            {linkExisting && (
              <div>
                <label className="block text-sm font-medium mb-1">UHID</label>
                <input {...register("uhid")} placeholder="UHID-000001"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
