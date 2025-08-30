import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: [
                "/icons/note-icon.png",
                "robots.txt",
                "/assets/main.css",
            ], // optional
            workbox: {
                globPatterns: ["**/*.{js,css,html,png,svg}"],
            },
            manifest: {
                name: "Table Note app by Aung Myat Htut",
                short_name: "Table Note",
                description:
                    "Table note app that you can summarize your daily data to the table.",
                theme_color: "#A9A9A9",
                background_color: "#ffffff",
                display: "standalone",
                start_url: "/",
                icons: [
                    {
                        src: "/icons/note-icon.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/icons/note-icon.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            },
        }),
    ],
});
