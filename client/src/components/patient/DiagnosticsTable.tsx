import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Diagnostic {
    id: string;
    visitId: string;
    name: string;
    description?: string;
    severity?: string;
    date: string | Date; // Visit startedAt
}

interface DiagnosticsTableProps {
    diagnostics: Diagnostic[];
    onVisitClick: (visitId: string) => void;
}

export default function DiagnosticsTable({ diagnostics, onVisitClick }: DiagnosticsTableProps) {
    if (diagnostics.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                <p className="text-4xl mb-2">🩺</p>
                <p>No diagnostics history found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px]">Date</TableHead>
                        <TableHead>Diagnosis</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {diagnostics.map((diag) => (
                        <TableRow key={diag.id} className="hover:bg-gray-50/50">
                            <TableCell className="font-medium text-gray-600">
                                {format(new Date(diag.date), "PPP")}
                            </TableCell>
                            <TableCell>
                                <div className="font-semibold text-gray-800">{diag.name}</div>
                                {diag.description && (
                                    <div className="text-sm text-gray-500 mt-0.5">{diag.description}</div>
                                )}
                            </TableCell>
                            <TableCell>
                                {diag.severity && (
                                    <Badge variant="outline" className={
                                        diag.severity === "high" || diag.severity === "critical"
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : "bg-gray-100 text-gray-600"
                                    }>
                                        {diag.severity}
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <button
                                    onClick={() => onVisitClick(diag.visitId)}
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
