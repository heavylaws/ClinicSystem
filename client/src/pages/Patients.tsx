import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import NewPatientDialog from "../components/NewPatientDialog";
import SmartExtractionDialog from "../components/SmartExtractionDialog";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function Patients() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<{
        firstName: string;
        middleName: string;
        lastName: string;
        lastVisit: Date | undefined;
    }>({
        firstName: "",
        middleName: "",
        lastName: "",
        lastVisit: undefined
    });
    const [page, setPage] = useState(1);
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [showSmartExtraction, setShowSmartExtraction] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const limit = 10;

    const handleFilterChange = (key: keyof typeof filters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const isSearchMode = !!(filters.firstName || filters.middleName || filters.lastName || filters.lastVisit);

    // Search query
    const { data: searchResults = [], isFetching: isSearching } = useQuery({
        queryKey: ["patients", "search", filters],
        queryFn: () => api.patients.search(filters),
        enabled: isSearchMode,
    });

    // List query (default)
    const { data: listData, isFetching: isListing } = useQuery({
        queryKey: ["patients", "list", page, limit],
        queryFn: () => api.patients.list(page, limit),
        enabled: !isSearchMode,
        placeholderData: keepPreviousData,
    });

    const patients = isSearchMode ? searchResults : (listData?.patients || []);
    const isLoading = isSearchMode ? isSearching : isListing;
    const totalPages = listData?.total ? Math.ceil(listData.total / limit) : 0;

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">👥 Patients Directory</h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowSmartExtraction(true)}
                        className="px-6 py-3 bg-white border-2 border-primary-200 text-primary-700 font-bold rounded-xl shadow-sm hover:bg-primary-50 transition flex items-center gap-2"
                    >
                        ✨ Smart Scan
                    </button>
                    <button
                        onClick={() => {
                            setExtractedData(null);
                            setShowNewPatient(true);
                        }}
                        className="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-md hover:bg-primary-700 transition"
                    >
                        ➕ New Patient
                    </button>
                </div>
            </div>

            {/* ─── Search Bar ─── */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        type="text"
                        value={filters.firstName}
                        onChange={(e) => handleFilterChange("firstName", e.target.value)}
                        placeholder="First Name"
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none"
                    />
                    <input
                        type="text"
                        value={filters.middleName}
                        onChange={(e) => handleFilterChange("middleName", e.target.value)}
                        placeholder="Middle Name"
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none"
                    />
                    <input
                        type="text"
                        value={filters.lastName}
                        onChange={(e) => handleFilterChange("lastName", e.target.value)}
                        placeholder="Last Name"
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none"
                    />
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={`w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-left focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none flex items-center justify-between ${!filters.lastVisit ? "text-gray-400" : "text-gray-900"
                                    }`}
                            >
                                {filters.lastVisit ? format(filters.lastVisit, "PPP") : "Last Visit Date"}
                                <span className="text-xl">📅</span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={filters.lastVisit}
                                onSelect={(date: Date | undefined) => handleFilterChange("lastVisit", date)}
                                disabled={(date: Date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                {/* Clear Filters */}
                {(filters.firstName || filters.middleName || filters.lastName || filters.lastVisit) && (
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={() => setFilters({ firstName: "", middleName: "", lastName: "", lastVisit: undefined })}
                            className="text-red-500 hover:text-red-700 font-medium text-sm flex items-center gap-1"
                        >
                            ✕ Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {/* ─── Results ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-xl animate-pulse">Loading patients...</p>
                    </div>
                ) : patients.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
                        <p className="text-6xl mb-4">🔍</p>
                        <p className="text-xl">No patients found</p>
                        <button
                            onClick={() => setShowNewPatient(true)}
                            className="mt-4 text-primary-600 font-bold hover:underline"
                        >
                            Register new patient?
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Name</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Phone</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">City</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">File #</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Visits</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Last Visit</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {patients.map((patient: any) => (
                                        <tr
                                            key={patient.id}
                                            className="hover:bg-gray-50 transition cursor-pointer"
                                            onClick={() => navigate(`/patient/${patient.id}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-gray-900">
                                                    {patient.firstName} {patient.fatherName} {patient.lastName}
                                                </p>
                                                <p className="text-sm text-gray-500 capitalize">{patient.gender}</p>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{patient.phone || "—"}</td>
                                            <td className="px-6 py-4 text-gray-600">{patient.city || "—"}</td>
                                            <td className="px-6 py-4 text-gray-600">#{patient.fileNumber}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-bold px-3 py-1 rounded-full text-xs">
                                                    {patient.visitCount ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {patient.lastVisit ? format(new Date(patient.lastVisit), "MMM d, yyyy") : "—"}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-primary-600 font-semibold text-sm">View File →</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination (Only for list mode) */}
                        {!isSearchMode && totalPages > 1 && (
                            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page <span className="font-medium text-gray-900">{page}</span> of{" "}
                                    <span className="font-medium text-gray-900">{totalPages}</span>
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── New Patient Dialog ─── */}
            {showNewPatient && (
                <NewPatientDialog
                    onClose={() => setShowNewPatient(false)}
                    initialData={extractedData}
                    onCreated={(patient: any) => {
                        setShowNewPatient(false);
                        navigate(`/patient/${patient.id}`);
                    }}
                />
            )}

            {/* ─── Smart Extraction Dialog ─── */}
            {showSmartExtraction && (
                <SmartExtractionDialog
                    onClose={() => setShowSmartExtraction(false)}
                    onExtracted={(data) => {
                        setExtractedData(data);
                        setShowSmartExtraction(false);
                        setShowNewPatient(true);
                    }}
                />
            )}
        </div>
    );
}
