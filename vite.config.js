import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const products = [];

function backendApi() {
  return {
    name: "cabael-backend-api",
    configureServer(server) {
      server.middlewares.use("/api/product", async (req, res, next) => {
        if (req.method === "GET") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(products));
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", chunk => { body += chunk; });
          req.on("end", () => {
            try {
              const input = JSON.parse(body || "{}");
              products.push(input);
              console.log("\n========== BACKEND SUBMIT ==========");
              console.log("Name:", input.name);
              console.log("Price:", input.price);
              console.log("====================================\n");
              res.statusCode = 201;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(input));
            } catch (error) {
              console.error("Backend input error:", error);
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), backendApi()],
  server: {
    port: 5173,
    strictPort: true
  }
});
