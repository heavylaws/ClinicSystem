import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PatientFile from "./pages/PatientFile";
import Layout from "./components/Layout";
import Reports from "./pages/Reports";
import Billing from "./pages/Billing";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import Users from "./pages/Users";
import Settings from "./pages/Settings";

export default function App() {
    const { data: user, isLoading } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: api.auth.me,
        retry: false,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-2xl text-gray-400 animate-pulse">🩺 DermClinic</div>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <Routes>
            <Route element={<Layout user={user} />}>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/room/:id" element={<PatientFile user={user} />} /> {/* Keep backend room logic if needed, but patient file is main */}
                <Route path="/patient/:id" element={<PatientFile user={user} />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
