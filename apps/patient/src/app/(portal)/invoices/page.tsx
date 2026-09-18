"use client";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CreditCard, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import api from "@/lib/api";
import { formatDate, formatCurrency, statusColor } from "@/lib/utils";
import type { Invoice } from "@/types";

// Razorpay checkout script loader (idempotent)
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function InvoiceCard({ inv }: { inv: Invoice }) {
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lineItems: any[] = Array.isArray(inv.lineItems) ? inv.lineItems : [];
  const tax = Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount);
  const isPaid = inv.paymentStatus === "PAID";

  const handlePayOnline = useCallback(async () => {
    setPaying(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast({ title: "Error", description: "Could not load payment gateway. Check your connection.", variant: "destructive" });
        return;
      }

      // Create order on backend
      const orderRes = await api.post("/patient-portal/payments/create-order", { invoiceId: inv.id });
      const { orderId, amount, currency, keyId } = orderRes.data;

      // Open Razorpay modal
      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: keyId,
          amount,
          currency,
          order_id: orderId,
          name: "Megnim Health",
          description: `Invoice #${inv.invoiceNumber}`,
          theme: { color: "#2563eb" },
          handler: async (response: any) => {
            try {
              // Verify on backend
              await api.post("/patient-portal/payments/verify", {
                invoiceId: inv.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast({ title: "Payment successful!", description: `Invoice #${inv.invoiceNumber} has been paid.`, variant: "success" });
              queryClient.invalidateQueries({ queryKey: ["invoices"] });
              resolve();
            } catch (err: any) {
              toast({
                title: "Verification failed",
                description: err?.response?.data?.message ?? "Payment recorded but verification failed. Contact support.",
                variant: "destructive",
              });
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("dismissed")),
          },
        });
        rzp.open();
      });
    } catch (err: any) {
      if (err?.message !== "dismissed") {
        toast({
          title: "Payment failed",
          description: err?.response?.data?.message ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setPaying(false);
    }
  }, [inv.id, inv.invoiceNumber, toast, queryClient]);

  return (
    <Card className={inv.paymentStatus === "PENDING" ? "border-yellow-200" : ""}>
      <CardContent className="py-4 px-5">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-start justify-between gap-4 text-left"
        >
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">Invoice #{inv.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {inv.invoiceType?.toLowerCase().replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate || inv.createdAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(inv.paymentStatus)}`}>
              {inv.paymentStatus}
            </span>
            <p className="text-base font-bold">{formatCurrency(Number(inv.totalAmount))}</p>
            {open
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {open && (
          <div className="mt-4 border-t pt-4 space-y-4">
            {/* Line items */}
            {lineItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-1.5">
                  {lineItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{item.description ?? item.name ?? "Item"}</p>
                        {item.quantity && item.unitPrice && (
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × {formatCurrency(Number(item.unitPrice))}
                          </p>
                        )}
                      </div>
                      <p className="font-medium shrink-0">
                        {formatCurrency(Number(item.total ?? item.amount ?? 0))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-lg bg-gray-50 px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(Number(inv.subtotal))}</span>
              </div>
              {Number(inv.discountAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600">−{formatCurrency(Number(inv.discountAmount))}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t pt-1.5 mt-1">
                <span>Total</span>
                <span>{formatCurrency(Number(inv.totalAmount))}</span>
              </div>
            </div>

            {isPaid ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Paid on {formatDate(inv.paidAt)} via {inv.paymentMethod?.replace(/_/g, " ") ?? "—"}
              </div>
            ) : (
              <Button
                className="w-full"
                size="sm"
                onClick={handlePayOnline}
                disabled={paying}
              >
                {paying
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                  : `Pay ${formatCurrency(Number(inv.totalAmount))} Online`
                }
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", page],
    queryFn: () =>
      api
        .get<{ data: Invoice[]; totalPages: number }>(
          `/patient-portal/invoices?page=${page}&limit=10`,
        )
        .then((r) => r.data),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">My Bills</h1>
        <p className="text-sm text-muted-foreground">View and pay your hospital invoices</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.data.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No invoices found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((inv) => (
            <InvoiceCard key={inv.id} inv={inv} />
          ))}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">
                Page {page} of {data?.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === data?.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
