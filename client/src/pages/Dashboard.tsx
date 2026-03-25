
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useWebSocket } from "../lib/ws";
import NewPatientDialog from "../components/NewPatientDialog";
import BillVisitDialog from "../components/BillVisitDialog";

interface DashboardProps {
    user: any;
}

export default function Dashboard({ user }: DashboardProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [selectedVisitForBilling, setSelectedVisitForBilling] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // ─── Queries ──────────────────────────────────────────────────────

    const { data: queue = [], refetch: refetchQueue } = useQuery({
        queryKey: ["queue"],
        queryFn: api.visits.queue,
        refetchInterval: 15000,
    });

    const { data: searchResults = [], isFetching: isSearching } = useQuery({
        queryKey: ["patients", "search", searchQuery],
        queryFn: () => api.patients.search(searchQuery),
        enabled: searchQuery.length >= 1,
    });

    const { data: recentPatientsData, isFetching: isFetchingRecent } = useQuery({
        queryKey: ["patients", "recent"],
        queryFn: () => api.patients.list(1, 10),
        enabled: isSearchFocused && searchQuery.length === 0,
    });
    const recentPatients = recentPatientsData?.patients || [];

    const { data: dailySummary } = useQuery({
        queryKey: ["reports", "daily"],
        queryFn: () => api.reports.daily(),
    });

    const { data: overdueFollowUps = [] } = useQuery({
        queryKey: ["followups", "overdue"],
        queryFn: () => api.followUps.overdue(),
    });

    const { data: upcomingFollowUps = [] } = useQuery({
        queryKey: ["followups", "upcoming"],
        queryFn: () => api.followUps.upcoming(),
    });

    // ─── WebSocket for real-time queue ────────────────────────────────

    useWebSocket("queue:update", () => {
        refetchQueue();
    });

    // ─── Mutations ────────────────────────────────────────────────────

    const queuePatientMutation = useMutation({
        mutationFn: (patientId: string) =>
            api.visits.create({ patientId, visitType: "consultation" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queue"] });
            setSearchQuery("");
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            api.visits.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queue"] });
        },
    });

    const deleteVisitMutation = useMutation({
        mutationFn: (id: string) => api.visits.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queue"] });
        },
    });

    const logoutMutation = useMutation({
        mutationFn: api.auth.logout,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
    });

    // ─── Render ───────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header removed - using Layout */}


            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ─── Left Column: Search & Patients ─── */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Search */}
                        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                🔎 Search Patient
                            </h2>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                placeholder="Patient name or phone number..."
                                className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none relative z-10"
                                autoFocus
                            />

                            {/* Search Results */}
                            {(searchQuery.length >= 1 || (isSearchFocused && searchQuery.length === 0)) && (
                                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                                    {(isSearching || (isSearchFocused && searchQuery.length === 0 && isFetchingRecent)) && (
                                        <p className="text-gray-400 text-center py-4">Searching...</p>
                                    )}
                                    {searchQuery.length >= 1 && !isSearching && searchResults.length === 0 && (
                                        <div className="text-center py-6">
                                            <p className="text-gray-400 mb-3">No results found</p>
                                            <button
                                                onClick={() => setShowNewPatient(true)}
                                                className="px-6 py-3 bg-primary-600 text-white rounded-xl text-lg font-semibold hover:bg-primary-700 transition"
                                            >
                                                ➕ New Patient
                                            </button>
                                        </div>
                                    )}
                                    {searchQuery.length === 0 && !isFetchingRecent && recentPatients.length > 0 && (
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 mb-2 mt-2">Recent Patients</p>
                                    )}
                                    {(searchQuery.length >= 1 ? searchResults : recentPatients).map((patient: any) => (
                                        <div
                                            key={patient.id}
                                            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-primary-50 rounded-xl cursor-pointer transition group"
                                        >
                                            <div
                                                className="flex-1"
                                                onClick={() => navigate(`/patient/${patient.id}`)}
                                            >
                                                <p className="text-lg font-bold text-gray-800 group-hover:text-primary-700">
                                                    {patient.firstName} {patient.fatherName ? `${patient.fatherName} ` : ""}{patient.lastName}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    #{patient.fileNumber} • {patient.city || "—"} • {patient.phone || "—"}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    queuePatientMutation.mutate(patient.id);
                                                    setIsSearchFocused(false);
                                                }}
                                                className="px-4 py-2 bg-accent-500 text-white rounded-lg font-semibold hover:bg-accent-600 transition text-sm"
                                                title="Add to queue"
                                            >
                                                📋 Queue
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* New Patient Button */}
                        <button
                            onClick={() => setShowNewPatient(true)}
                            className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl hover:from-primary-700 hover:to-primary-800 transition-all"
                        >
                            ➕ Register New Patient
                        </button>

                        {/* Daily Summary */}
                        {dailySummary && (
                            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-700 mb-4">📊 Today's Summary</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-primary-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-extrabold text-primary-700">
                                            {dailySummary.visitCount}
                                        </p>
                                        <p className="text-sm text-primary-500 mt-1">Visits</p>
                                    </div>
                                    <div className="bg-accent-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-extrabold text-accent-700">
                                            {dailySummary.uniquePatients}
                                        </p>
                                        <p className="text-sm text-accent-500 mt-1">Patients</p>
                                    </div>
                                    <div className="bg-warm-50 rounded-xl p-4 text-center">
                                        <p className="text-2xl font-extrabold text-warm-500">
                                            ${dailySummary.totalPaid}
                                        </p>
                                        <p className="text-sm text-warm-500 mt-1">Collected</p>
                                    </div>
                                    <div className="bg-danger-50 rounded-xl p-4 text-center">
                                        <p className="text-2xl font-extrabold text-danger-600">
                                            ${dailySummary.outstanding}
                                        </p>
                                        <p className="text-sm text-danger-500 mt-1">Outstanding</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Follow-up Reminders */}
                        {(overdueFollowUps.length > 0 || upcomingFollowUps.length > 0) && (
                            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-700 mb-4">📅 Follow-up Reminders</h3>

                                {overdueFollowUps.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-sm font-bold text-red-600 mb-2 uppercase tracking-wide">⚠️ Overdue</p>
                                        <div className="space-y-2">
                                            {overdueFollowUps.slice(0, 5).map((fu: any) => (
                                                <div
                                                    key={fu.id}
                                                    onClick={() => navigate(`/patient/${fu.patientId}`)}
                                                    className="flex items-center gap-3 p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition border border-red-200"
                                                >
                                                    <span className="text-red-500 font-mono text-sm">{fu.scheduledDate}</span>
                                                    <span className="font-semibold text-gray-800 text-sm">
                                                        {fu.patientName} {fu.patientLastName}
                                                    </span>
                                                    <span className="text-gray-400 text-xs ml-auto">#{fu.patientFileNumber}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {upcomingFollowUps.length > 0 && (
                                    <div>
                                        <p className="text-sm font-bold text-teal-600 mb-2 uppercase tracking-wide">📅 Upcoming</p>
                                        <div className="space-y-2">
                                            {upcomingFollowUps.slice(0, 5).map((fu: any) => (
                                                <div
                                                    key={fu.id}
                                                    onClick={() => navigate(`/patient/${fu.patientId}`)}
                                                    className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg cursor-pointer hover:bg-teal-100 transition border border-teal-200"
                                                >
                                                    <span className="text-teal-600 font-mono text-sm">{fu.scheduledDate}</span>
                                                    <span className="font-semibold text-gray-800 text-sm">
                                                        {fu.patientName} {fu.patientLastName}
                                                    </span>
                                                    <span className="text-gray-400 text-xs ml-auto">#{fu.patientFileNumber}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ─── Right Column: Today's Queue ─── */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                                📋 Today's Queue
                                <span className="text-sm bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-semibold">
                                    {queue.length} patients
                                </span>
                            </h2>

                            {queue.length === 0 ? (
                                <div className="text-center py-16 text-gray-400">
                                    <p className="text-6xl mb-4">📭</p>
                                    <p className="text-xl">No patients in today's queue</p>
                                    <p className="text-lg mt-2">Search for a patient to add them</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {queue.map((item: any, idx: number) => (
                                        <div
                                            key={item.id}
                                            className={`flex items-center gap-4 p-5 rounded-xl border-2 transition cursor-pointer hover:shadow-md ${item.status === "in_progress"
                                                ? "border-primary-300 bg-primary-50"
                                                : item.status === "completed"
                                                    ? "border-accent-200 bg-accent-50"
                                                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                                                }`}
                                            onClick={() => navigate(`/patient/${item.patientId}`)}
                                        >
                                            {/* Number */}
                                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-600">
                                                {idx + 1}
                                            </div>

                                            {/* Patient Info */}
                                            <div className="flex-1">
                                                <p className="text-xl font-bold text-gray-800">
                                                    {item.patientName}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    File #{item.patientFileNumber} • Visit #{item.visitNumber}
                                                </p>
                                            </div>

                                            {/* Status Badge */}
                                            <div className={`px-4 py-2 rounded-full text-sm font-bold status-${item.status}`}>
                                                {item.status === "queued" && "⏳ Waiting"}
                                                {item.status === "in_progress" && "🔵 In Progress"}
                                                {item.status === "completed" && "✅ Completed"}
                                                {item.status === "billed" && "💰 Billed"}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                {item.status === "queued" && ["doctor", "admin"].includes(user.role) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateStatusMutation.mutate({
                                                                id: item.id,
                                                                status: "in_progress",
                                                            });
                                                        }}
                                                        className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition"
                                                    >
                                                        ▶ Start
                                                    </button>
                                                )}

                                                {item.status === "queued" && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm("Remove this patient from the queue?")) {
                                                                deleteVisitMutation.mutate(item.id);
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                                                        title="Remove from queue"
                                                    >
                                                        ❌ Remove
                                                    </button>
                                                )}

                                                {item.status === "completed" && ["reception", "admin"].includes(user.role) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVisitForBilling(item.id);
                                                        }}
                                                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-1"
                                                    >
                                                        💰 Pay / Close
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── New Patient Dialog ─── */}
            {showNewPatient && (
                <NewPatientDialog
                    onClose={() => setShowNewPatient(false)}
                    onCreated={(patient: any) => {
                        setShowNewPatient(false);
                        navigate(`/patient/${patient.id}`);
                    }}
                />
            )}

            {/* ─── Billing Dialog ─── */}
            {selectedVisitForBilling && (
                <BillVisitDialog
                    visitId={selectedVisitForBilling}
                    onClose={() => setSelectedVisitForBilling(null)}
                />
            )}
        </div>
    );
}
