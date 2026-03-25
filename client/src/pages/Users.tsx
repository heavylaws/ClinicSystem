import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const ROLES = ["admin", "doctor", "reception"] as const;
const ROLE_COLORS: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    doctor: "bg-blue-100 text-blue-700",
    reception: "bg-emerald-100 text-emerald-700",
};

export default function Users() {
    const queryClient = useQueryClient();
    const [showDialog, setShowDialog] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [showResetPw, setShowResetPw] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState("");

    // Form state
    const [formUsername, setFormUsername] = useState("");
    const [formDisplayName, setFormDisplayName] = useState("");
    const [formPassword, setFormPassword] = useState("");
    const [formRole, setFormRole] = useState<string>("reception");

    const { data: users = [], isLoading } = useQuery({
        queryKey: ["users"],
        queryFn: () => api.users.list(),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.users.create(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); closeDialog(); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: any) => api.users.update(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); closeDialog(); },
    });

    const resetPwMutation = useMutation({
        mutationFn: ({ id, password }: { id: string; password: string }) =>
            api.users.resetPassword(id, password),
        onSuccess: () => { setShowResetPw(null); setNewPassword(""); },
    });

    function openCreate() {
        setEditingUser(null);
        setFormUsername("");
        setFormDisplayName("");
        setFormPassword("");
        setFormRole("reception");
        setShowDialog(true);
    }

    function openEdit(user: any) {
        setEditingUser(user);
        setFormUsername(user.username);
        setFormDisplayName(user.displayName);
        setFormRole(user.role);
        setFormPassword("");
        setShowDialog(true);
    }

    function closeDialog() {
        setShowDialog(false);
        setEditingUser(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (editingUser) {
            updateMutation.mutate({ id: editingUser.id, displayName: formDisplayName, role: formRole });
        } else {
            createMutation.mutate({
                username: formUsername,
                password: formPassword,
                displayName: formDisplayName,
                role: formRole,
            });
        }
    }

    function toggleActive(user: any) {
        updateMutation.mutate({ id: user.id, isActive: !user.isActive });
    }

    return (
        <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">👥 User Management</h1>
                <button
                    onClick={openCreate}
                    className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition shadow-sm"
                >
                    + Add User
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 text-left">
                                <th className="px-6 py-4 text-sm font-semibold text-gray-500">User</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-500">Username</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-500">Role</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-500">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user: any) => (
                                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
                                                {user.displayName.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-semibold text-gray-800">{user.displayName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-mono text-sm">{user.username}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-600"}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleActive(user)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${user.isActive
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-red-100 text-red-600"
                                                }`}
                                        >
                                            {user.isActive ? "Active" : "Disabled"}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => openEdit(user)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => { setShowResetPw(user.id); setNewPassword(""); }}
                                                className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-semibold hover:bg-orange-100 transition"
                                            >
                                                Reset PW
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / Edit Dialog */}
            {showDialog && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeDialog}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            {editingUser ? "Edit User" : "New User"}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={formUsername}
                                        onChange={(e) => setFormUsername(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        required
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={formDisplayName}
                                    onChange={(e) => setFormDisplayName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    required
                                />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={formPassword}
                                        onChange={(e) => setFormPassword(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        required
                                        minLength={4}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                <select
                                    value={formRole}
                                    onChange={(e) => setFormRole(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                    {ROLES.map((r) => (
                                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeDialog}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                >
                                    {editingUser ? "Update" : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Dialog */}
            {showResetPw && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowResetPw(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Reset Password</h3>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password..."
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none mb-4"
                            minLength={4}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowResetPw(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => newPassword.length >= 4 && resetPwMutation.mutate({ id: showResetPw, password: newPassword })}
                                disabled={newPassword.length < 4 || resetPwMutation.isPending}
                                className="flex-1 px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
