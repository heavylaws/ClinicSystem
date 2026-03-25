
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useToast } from "./ui/use-toast";
import { X, CreditCard, Banknote } from "lucide-react";

interface BillVisitDialogProps {
    visitId: string;
    onClose: () => void;
}

export default function BillVisitDialog({ visitId, onClose }: BillVisitDialogProps) {
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Fetch visit details to get billing info
    const { data: visit, isLoading } = useQuery({
        queryKey: ["visit", visitId],
        queryFn: () => api.visits.get(visitId),
    });

    const processPaymentMutation = useMutation({
        mutationFn: async () => {
            // 1. Create billing record if not exists (handled by backend usually, but ensuring we have a bill)
            // For now, we assume the bill is generated. We'll simulate payment by updating status to 'billed'
            // In a real app, we'd have a specific payment endpoint. 
            // Based on current API, updating status to 'billed' might be the way, 
            // or we might need to hit a specific billing endpoint if it exists.
            // Looking at api.ts, we have `api.billing.createPayment(billingId, ...)`
            // We first need the billing ID.

            let billingId = visit?.billing?.id;

            if (!billingId) {
                // If the doctor never clicked "Save Billing" inside the PatientFile,
                // we should explicitly create a $0.00 bill now so it shows up in reports.
                const newBill = await api.billing.save({
                    visitId,
                    totalAmount: "0.00",
                    currency: "USD",
                    notes: "Auto-generated at checkout"
                });
                billingId = newBill.id;
            }

            if (billingId) {
                await api.billing.addPayment({
                    billingId,
                    amount: String(visit?.billing?.totalAmount || "0.00"),
                    method: paymentMethod
                });
            }

            // Finally update status to billed to remove from queue/mark done
            await api.visits.updateStatus(visitId, "billed");
        },
        onSuccess: () => {
            toast({
                title: "Payment Successful",
                description: "The visit has been marked as paid and closed.",
                variant: "success",
            });
            queryClient.invalidateQueries({ queryKey: ["queue"] });
            onClose();
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to process payment. Please try again.",
                variant: "destructive"
            });
        }
    });

    if (isLoading) return null;

    const totalAmount = visit?.billing?.totalAmount || "0.00";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-primary-600 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        💸 Collect Payment
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition rounded-full p-1 hover:bg-primary-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">

                    {/* Amount Display */}
                    <div className="text-center py-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Total Due</p>
                        <p className="text-4xl font-extrabold text-gray-900">${totalAmount}</p>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700">Payment Method</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("cash")}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition ${paymentMethod === "cash"
                                    ? "border-primary-500 bg-primary-50 text-primary-700"
                                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                                    }`}
                            >
                                <Banknote className="mb-2" size={24} />
                                <span className="font-bold">Cash</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("card")}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition ${paymentMethod === "card"
                                    ? "border-primary-500 bg-primary-50 text-primary-700"
                                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                                    }`}
                            >
                                <CreditCard className="mb-2" size={24} />
                                <span className="font-bold">Card</span>
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2">
                        <button
                            onClick={() => processPaymentMutation.mutate()}
                            disabled={processPaymentMutation.isPending}
                            className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl shadow-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {processPaymentMutation.isPending ? (
                                <>Processing...</>
                            ) : (
                                <>Mark as Paid & Close</>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
