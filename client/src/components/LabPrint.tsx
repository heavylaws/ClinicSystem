import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface LabPrintProps {
    patient: any;
    visit: any;
    labOrders: any[];
    diagnoses: any[];
    onClose: () => void;
}

export default function LabPrint({
    patient,
    visit,
    labOrders,
    diagnoses,
    onClose,
}: LabPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const { data: settings } = useQuery({
        queryKey: ["settings"],
        queryFn: () => api.settings.get(),
        staleTime: 60000,
    });

    const clinicName = settings?.clinic_name || "DermClinic";
    const clinicSubtitle = settings?.clinic_subtitle || "Dermatology & Skin Care Center";
    const clinicPhone = settings?.clinic_phone || "";

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
            <head>
                <title>Lab Request - ${patient.firstName} ${patient.lastName}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20mm; color: #333; }
                    .header { text-align: center; border-bottom: 3px double #0891b2; padding-bottom: 16px; margin-bottom: 20px; }
                    .clinic-name { font-size: 24px; font-weight: bold; color: #0e7490; }
                    .clinic-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
                    .patient-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 12px; background: #f0f9ff; border-radius: 8px; }
                    .patient-info div { font-size: 13px; }
                    .patient-info .label { font-weight: 600; color: #64748b; }
                    .patient-info .value { font-weight: 700; color: #0f172a; }
                    .section-title { font-size: 15px; font-weight: 700; color: #0891b2; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
                    .lab-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                    .lab-table th { text-align: left; padding: 8px 12px; background: #f0f9ff; color: #0e7490; font-size: 12px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #bae6fd; }
                    .lab-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                    .lab-table tr:last-child td { border-bottom: none; }
                    .lab-num { color: #0ea5e9; font-weight: 700; font-size: 16px; min-width: 40px; }
                    .test-name { font-weight: 700; color: #0f172a; }
                    .diagnosis-list { display: flex; flex-wrap: wrap; gap: 6px; }
                    .diagnosis-tag { background: #f0f9ff; color: #0e7490; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
                    .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .signature { text-align: center; }
                    .signature-line { width: 220px; border-top: 2px solid #94a3b8; margin-top: 60px; padding-top: 8px; font-size: 12px; color: #64748b; font-weight: 600; }
                    @media print { body { padding: 10mm; } }
                </style>
            </head>
            <body>
                ${content.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    const visitDate = visit?.startedAt ? new Date(visit.startedAt) : new Date();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        🧪 Lab Test Request Preview
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition flex items-center gap-2 shadow-md"
                        >
                            🖨️ Print Request
                        </button>
                        <button onClick={onClose} className="px-3 py-2 text-gray-400 hover:text-gray-600 transition">✕</button>
                    </div>
                </div>

                {/* Printable Content */}
                <div ref={printRef} className="p-10">
                    {/* Header */}
                    <div className="header" style={{ textAlign: "center", borderBottom: "3px double #0891b2", paddingBottom: "16px", marginBottom: "24px" }}>
                        <div className="clinic-name" style={{ fontSize: "24px", fontWeight: "bold", color: "#0e7490" }}>🩺 {clinicName}</div>
                        <div className="clinic-subtitle" style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
                            {clinicSubtitle}{clinicPhone ? ` • ${clinicPhone}` : ""}
                        </div>
                        <div style={{ marginTop: "12px", fontSize: "18px", fontWeight: "800", color: "#0e7490", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Laboratory Examination Request
                        </div>
                    </div>

                    {/* Patient Info */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", padding: "16px", background: "#f0f9ff", borderRadius: "12px", border: "1px solid #e0f2fe" }}>
                        <div>
                            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600", marginBottom: "4px" }}>Patient Name</div>
                            <div style={{ fontWeight: "800", fontSize: "18px", color: "#0f172a" }}>{patient.firstName} {patient.lastName}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600", marginBottom: "4px" }}>File Number</div>
                            <div style={{ fontWeight: "800", fontSize: "16px", color: "#0f172a" }}>#{patient.fileNumber}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600", marginBottom: "4px" }}>Request Date</div>
                            <div style={{ fontWeight: "800", fontSize: "16px", color: "#0f172a" }}>
                                {visitDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                            </div>
                        </div>
                    </div>

                    {/* Diagnoses / Clinical Context */}
                    {diagnoses.length > 0 && (
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: "800", color: "#0891b2", marginBottom: "10px", paddingBottom: "4px", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase" }}>
                                Clinical Diagnosis
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                                {diagnoses.map((d: any, i: number) => (
                                    <span key={i} style={{ background: "#f0f9ff", color: "#0e7490", padding: "6px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", border: "1px solid #bae6fd" }}>
                                        {d.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lab Tests Table */}
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#0891b2", marginBottom: "10px", paddingBottom: "4px", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase" }}>
                        Requested Laboratory Tests
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px", marginBottom: "30px" }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: "left", padding: "12px", background: "#f0f9ff", color: "#0e7490", fontSize: "12px", fontWeight: "800", borderBottom: "2px solid #bae6fd", width: "60px" }}>#</th>
                                <th style={{ textAlign: "left", padding: "12px", background: "#f0f9ff", color: "#0e7490", fontSize: "12px", fontWeight: "800", borderBottom: "2px solid #bae6fd" }}>Test Description</th>
                                <th style={{ textAlign: "left", padding: "12px", background: "#f0f9ff", color: "#0e7490", fontSize: "12px", fontWeight: "800", borderBottom: "2px solid #bae6fd", width: "120px" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {labOrders.map((lab: any, idx: number) => (
                                <tr key={lab.id || idx}>
                                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", color: "#0ea5e9", fontWeight: "800", fontSize: "16px" }}>{idx + 1}</td>
                                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", fontWeight: "700", color: "#0f172a", fontSize: "15px" }}>{lab.testName}</td>
                                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", color: "#64748b", fontSize: "13px", fontStyle: "italic" }}>
                                        Ordered
                                    </td>
                                </tr>
                            ))}
                            {labOrders.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                                        No lab tests ordered for this visit.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Additional Notes */}
                    {visit?.clinicalNotes && (
                        <div style={{ marginBottom: "30px" }}>
                            <div style={{ fontSize: "14px", fontWeight: "800", color: "#0891b2", marginBottom: "8px", paddingBottom: "4px", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase" }}>
                                Clinical Notes / Special Instructions
                            </div>
                            <p style={{ fontSize: "13px", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{visit.clinicalNotes}</p>
                        </div>
                    )}

                    {/* Signature Area */}
                    <div style={{ marginTop: "60px", display: "flex", justifySelf: "flex-end", flexDirection: "column", alignItems: "flex-end" }}>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                            Generated on {new Date().toLocaleString()}
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ width: "220px", borderTop: "2px solid #0f172a", marginTop: "60px", paddingTop: "8px", fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                                Medical Practitioner
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                License & Stamp Signature
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
