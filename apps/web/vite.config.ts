import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, "../..", "");
  const restaurantTimeZone =
    process.env.RESTAURANT_TIME_ZONE ??
    environment.RESTAURANT_TIME_ZONE ??
    "Europe/Berlin";

  return {
    plugins: [react()],
    envDir: "../..",
    define: {
      "import.meta.env.VITE_RESTAURANT_TIME_ZONE": JSON.stringify(restaurantTimeZone),
    },
  };
});
