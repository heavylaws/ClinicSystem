import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface PrescriptionPrintProps {
    patient: any;
    visit: any;
    prescriptions: any[];
    diagnoses: any[];
    onClose: () => void;
}

export default function PrescriptionPrint({
    patient,
    visit,
    prescriptions,
    diagnoses,
    onClose,
}: PrescriptionPrintProps) {
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
                <title>Prescription - ${patient.firstName} ${patient.lastName}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20mm; color: #333; }
                    .header { text-align: center; border-bottom: 3px double #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
                    .clinic-name { font-size: 24px; font-weight: bold; color: #1e40af; }
                    .clinic-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
                    .patient-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; }
                    .patient-info div { font-size: 13px; }
                    .patient-info .label { font-weight: 600; color: #6b7280; }
                    .patient-info .value { font-weight: 700; color: #1e293b; }
                    .section-title { font-size: 15px; font-weight: 700; color: #1e40af; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
                    .rx-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                    .rx-table th { text-align: left; padding: 8px 12px; background: #eff6ff; color: #1e40af; font-size: 12px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #bfdbfe; }
                    .rx-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                    .rx-table tr:last-child td { border-bottom: none; }
                    .rx-num { color: #93c5fd; font-weight: 700; font-size: 16px; }
                    .med-name { font-weight: 700; color: #1e293b; }
                    .diagnosis-list { display: flex; flex-wrap: wrap; gap: 6px; }
                    .diagnosis-tag { background: #eff6ff; color: #1e40af; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
                    .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .signature { text-align: center; }
                    .signature-line { width: 200px; border-top: 1px solid #94a3b8; margin-top: 50px; padding-top: 8px; font-size: 12px; color: #6b7280; }
                    .date-info { font-size: 12px; color: #6b7280; }
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 border-b bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-gray-700">Print Preview</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition text-sm"
                        >
                            🖨️ Print
                        </button>
                        <button onClick={onClose} className="px-3 py-2 text-gray-500 hover:text-gray-700">✕</button>
                    </div>
                </div>

                {/* Printable Content */}
                <div ref={printRef} className="p-8">
                    {/* Header */}
                    <div className="header" style={{ textAlign: "center", borderBottom: "3px double #2563eb", paddingBottom: "16px", marginBottom: "20px" }}>
                        <div className="clinic-name" style={{ fontSize: "24px", fontWeight: "bold", color: "#1e40af" }}>🩺 {clinicName}</div>
                        <div className="clinic-subtitle" style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                            {clinicSubtitle}{clinicPhone ? ` • ${clinicPhone}` : ""}
                        </div>
                    </div>

                    {/* Patient Info */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", padding: "12px", background: "#f8fafc", borderRadius: "8px" }}>
                        <div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>Patient</div>
                            <div style={{ fontWeight: "700", fontSize: "16px" }}>{patient.firstName} {patient.lastName}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>File #</div>
                            <div style={{ fontWeight: "700" }}>{patient.fileNumber}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>Date</div>
                            <div style={{ fontWeight: "700" }}>{visitDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                        </div>
                    </div>

                    {/* Diagnoses */}
                    {diagnoses.length > 0 && (
                        <div>
                            <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e40af", margin: "16px 0 8px", paddingBottom: "4px", borderBottom: "1px solid #e2e8f0" }}>
                                Diagnosis
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {diagnoses.map((d: any, i: number) => (
                                    <span key={i} style={{ background: "#eff6ff", color: "#1e40af", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                                        {d.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prescriptions Table */}
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e40af", margin: "16px 0 8px", paddingBottom: "4px", borderBottom: "1px solid #e2e8f0" }}>
                        Prescription
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: "left", padding: "8px 12px", background: "#eff6ff", color: "#1e40af", fontSize: "12px", fontWeight: "700", borderBottom: "2px solid #bfdbfe" }}>#</th>
                                <th style={{ textAlign: "left", padding: "8px 12px", background: "#eff6ff", color: "#1e40af", fontSize: "12px", fontWeight: "700", borderBottom: "2px solid #bfdbfe" }}>Medication</th>
                                <th style={{ textAlign: "left", padding: "8px 12px", background: "#eff6ff", color: "#1e40af", fontSize: "12px", fontWeight: "700", borderBottom: "2px solid #bfdbfe" }}>Dosage</th>
                                <th style={{ textAlign: "left", padding: "8px 12px", background: "#eff6ff", color: "#1e40af", fontSize: "12px", fontWeight: "700", borderBottom: "2px solid #bfdbfe" }}>Frequency</th>
                                <th style={{ textAlign: "left", padding: "8px 12px", background: "#eff6ff", color: "#1e40af", fontSize: "12px", fontWeight: "700", borderBottom: "2px solid #bfdbfe" }}>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prescriptions.map((rx: any, idx: number) => (
                                <tr key={rx.id || idx}>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", color: "#93c5fd", fontWeight: "700", fontSize: "16px" }}>{idx + 1}</td>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: "700" }}>{rx.medicationName}</td>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>{rx.dosage || "—"}</td>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>{rx.frequency || "—"}</td>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>{rx.duration || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Instructions */}
                    {visit?.clinicalNotes && (
                        <div>
                            <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e40af", margin: "16px 0 8px", paddingBottom: "4px", borderBottom: "1px solid #e2e8f0" }}>
                                Notes
                            </div>
                            <p style={{ fontSize: "13px", color: "#4b5563" }}>{visit.clinicalNotes}</p>
                        </div>
                    )}

                    {/* Signature Area */}
                    <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Visit #{visit?.visitNumber}
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ width: "200px", borderTop: "1px solid #94a3b8", marginTop: "50px", paddingTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                                Doctor's Signature
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
