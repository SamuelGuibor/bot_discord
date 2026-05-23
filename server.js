import http from "http";
import { processNotification } from "./worker.js";

export function startWebhookServer() {
    const PORT = 8080;
    const SECRET = process.env.WEBHOOK_SECRET;

    const server = http.createServer(async (req, res) => {
        if (req.method === "POST" && req.url === "/webhook/notify") {
            if (SECRET && req.headers["x-webhook-secret"] !== SECRET) {
                res.writeHead(401);
                res.end("Unauthorized");
                return;
            }

            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
                try {
                    const record = JSON.parse(body);
                    console.log(`🔔 Webhook recebido → id: ${record.id}`);
                    await processNotification(record);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    console.error("Erro no webhook:", err);
                    res.writeHead(500);
                    res.end("Internal Server Error");
                }
            });
        } else {
            res.writeHead(404);
            res.end("Not Found");
        }
    });

    server.listen(PORT, () => {
        console.log(`🌐 Webhook server rodando na porta ${PORT}`);
    });
}
