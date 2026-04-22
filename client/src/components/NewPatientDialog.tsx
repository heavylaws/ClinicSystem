import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface NewPatientDialogProps {
    onClose: () => void;
    onCreated: (patient: any) => void;
    initialData?: Partial<any>;
}

export default function NewPatientDialog({
    onClose,
    onCreated,
    initialData,
}: NewPatientDialogProps) {
    const [form, setForm] = useState({
        firstName: initialData?.firstName || "",
        lastName: initialData?.lastName || "",
        fatherName: initialData?.fatherName || "",
        gender: initialData?.gender || "",
        phone: initialData?.phone || "",
        city: initialData?.city || "",
        maritalStatus: initialData?.maritalStatus || "",
        insurance: initialData?.insurance || "",
    });
    const [error, setError] = useState("");
    const [insuranceSuggestions, setInsuranceSuggestions] = useState<string[]>([]);
    const [showInsuranceSuggestions, setShowInsuranceSuggestions] = useState(false);

    const fetchInsuranceSuggestions = async (q: string) => {
        if (q.length < 1) { setInsuranceSuggestions([]); return; }
        try {
            const results = await api.patients.insuranceSuggestions(q);
            setInsuranceSuggestions(results);
            setShowInsuranceSuggestions(results.length > 0);
        } catch { setInsuranceSuggestions([]); }
    };

    const mutation = useMutation({
        mutationFn: () => api.patients.create(form),
        onSuccess: (patient) => onCreated(patient),
        onError: (err: Error) => setError(err.message),
    });

    const updateField = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-extrabold text-gray-800">➕ Register New Patient</h2>
                        <button
                            onClick={onClose}
                            className="text-3xl text-gray-400 hover:text-gray-600 transition"
                        >
                            ✕
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            mutation.mutate();
                        }}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-2">
                                    First Name *
                                </label>
                                <input
                                    type="text"
                                    value={form.firstName}
                                    onChange={(e) => updateField("firstName", e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl focus:border-primary-500 outline-none"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-2">
                                    Last Name *
                                </label>
                                <input
                                    type="text"
                                    value={form.lastName}
                                    onChange={(e) => updateField("lastName", e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl focus:border-primary-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-2">
                                    Father's Name
                                </label>
                                <input
                                    type="text"
                                    value={form.fatherName}
                                    onChange={(e) => updateField("fatherName", e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl focus:border-primary-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-2">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => updateField("phone", e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl focus:border-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-2">
                                    Gender
                                </label>
                                <select
                                    value={form.gender}
                                    onChange={(e) => updateField("gender", e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl focus:border-primary-500 outline-none"
                                >
                                    <option value="">—</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-2">
                                    City
                                </label>
                                <input
                                    type="text"
                                    value={form.city}
                                    onChange={(e) => updateField("city", e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl focus:border-primary-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-2">
                                    Status
                                </label>
                                <select
                                    value={form.maritalStatus}
                                    onChange={(e) => updateField("maritalStatus", e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl focus:border-primary-500 outline-none"
                                >
                                    <option value="">—</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Divorced">Divorced</option>
                                    <option value="Widowed">Widowed</option>
                                </select>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="block text-lg font-semibold text-blue-600 mb-2">
                                🛡️ Insurance / Assurance
                            </label>
                            <input
                                type="text"
                                value={form.insurance}
                                onChange={(e) => {
                                    updateField("insurance", e.target.value);
                                    fetchInsuranceSuggestions(e.target.value);
                                }}
                                onFocus={() => form.insurance && fetchInsuranceSuggestions(form.insurance)}
                                onBlur={() => setTimeout(() => setShowInsuranceSuggestions(false), 200)}
                                placeholder="e.g. daman, taawniye, moasaset shahid..."
                                className="w-full border-2 border-blue-200 bg-blue-50 rounded-xl px-4 py-3 text-xl focus:border-blue-500 outline-none"
                            />
                            {showInsuranceSuggestions && insuranceSuggestions.length > 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                    {insuranceSuggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-lg font-medium text-gray-700 transition"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                updateField("insurance", s);
                                                setShowInsuranceSuggestions(false);
                                            }}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl text-danger-700">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={mutation.isPending}
                                className="flex-1 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                            >
                                {mutation.isPending ? "Saving..." : "💾 Save"}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-8 py-4 bg-gray-100 text-gray-600 text-xl font-semibold rounded-xl hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
