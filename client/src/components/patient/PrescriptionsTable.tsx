import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface Prescription {
    id: string;
    visitId: string;
    medicationName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    date: string | Date; // Visit startedAt
}

interface PrescriptionsTableProps {
    prescriptions: Prescription[];
    onVisitClick: (visitId: string) => void;
}

export default function PrescriptionsTable({ prescriptions, onVisitClick }: PrescriptionsTableProps) {
    if (prescriptions.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                <p className="text-4xl mb-2">💊</p>
                <p>No prescription history found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px]">Date</TableHead>
                        <TableHead>Medication</TableHead>
                        <TableHead>Dosage / Freq</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {prescriptions.map((rx) => (
                        <TableRow key={rx.id} className="hover:bg-gray-50/50">
                            <TableCell className="font-medium text-gray-600">
                                {format(new Date(rx.date), "PPP")}
                            </TableCell>
                            <TableCell>
                                <div className="font-bold text-accent-700">{rx.medicationName}</div>
                                {rx.instructions && (
                                    <div className="text-sm text-gray-500 mt-0.5 italic">
                                        "{rx.instructions}"
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-0.5">
                                    {rx.dosage && <span className="font-medium">{rx.dosage}</span>}
                                    {rx.frequency && <span className="text-sm text-gray-500">{rx.frequency}</span>}
                                </div>
                            </TableCell>
                            <TableCell className="text-gray-600">
                                {rx.duration || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                                <button
                                    onClick={() => onVisitClick(rx.visitId)}
                                    className="text-primary-600 hover:text-primary-800 text-sm font-medium hover:underline"
                                >
                                    View Visit →
                                </button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
