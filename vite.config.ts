import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "client/src"),
            "@shared": path.resolve(__dirname, "shared"),
        },
    },
    root: "client",
    build: {
        outDir: "../dist/client",
        emptyOutDir: true,
    },
    server: {
        port: 5174,
        host: true,
        https: {
            key: fs.readFileSync(path.resolve(__dirname, "certs/key.pem")),
            cert: fs.readFileSync(path.resolve(__dirname, "certs/cert.pem")),
        },
        proxy: {
            "/api": {
                target: "http://localhost:3002",
                changeOrigin: true,
            },
            "/uploads": {
                target: "http://localhost:3002",
                changeOrigin: true,
            },
            "/ws": {
                target: "ws://localhost:3002",
                ws: true,
            },
        },
    },
});
