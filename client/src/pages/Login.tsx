import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const queryClient = useQueryClient();

    const loginMutation = useMutation({
        mutationFn: () => api.auth.login(username, password),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["auth"] });
        },
        onError: (err: Error) => {
            setError(err.message || "Login failed");
        },
    });

    const bootstrapMutation = useMutation({
        mutationFn: api.auth.bootstrap,
        onSuccess: () => {
            setError("");
            setUsername("admin");
            setPassword("admin123");
        },
        onError: (err: Error) => {
            setError(err.message);
        },
    });

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-xl mb-6">
                        <span className="text-5xl">🩺</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-primary-900 mb-2">
                        DermClinic
                    </h1>
                    <p className="text-xl text-gray-500">Clinic Management System</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-10 border border-gray-100">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            loginMutation.mutate();
                        }}
                    >
                        <div className="mb-6">
                            <label className="block text-lg font-semibold text-gray-700 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none"
                                placeholder="admin"
                                autoFocus
                                autoComplete="username"
                            />
                        </div>

                        <div className="mb-8">
                            <label className="block text-lg font-semibold text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none"
                                placeholder="••••••"
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-danger-50 border border-danger-100 rounded-xl text-danger-700 text-lg">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-xl font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                        >
                            {loginMutation.isPending ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    {/* Bootstrap button for first run */}
                    <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                        <button
                            type="button"
                            onClick={() => bootstrapMutation.mutate()}
                            disabled={bootstrapMutation.isPending}
                            className="text-sm text-gray-400 hover:text-primary-600 transition"
                        >
                            {bootstrapMutation.isPending
                                ? "Creating users..."
                                : "🔧 Initialize Default Users"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
