import { prisma } from "./db.js";
import { client } from "./index.js";
import pg from "pg";

const { Client } = pg;

async function createListenerConnection() {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    return pgClient;
}

function scheduleNextReport() {
    const now = new Date();
    const next = new Date();
    next.setHours(20, 0, 0, 0);

    if (now >= next) next.setDate(next.getDate() + 1);

    const delay = next - now;
    console.log(`📅 Próximo relatório em ${Math.round(delay / 60000)} minutos`);

    setTimeout(async () => {
        await sendDailyReports();
        scheduleNextReport();
    }, delay);
}

async function sendDailyReports() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const reportsConfig = [
        {
            channelId: '1493999520139448522',
            name: 'Contratações',
            buildEmbed: (total) => ({
                title: "📊 Relatório Diário de Contratações",
                description: "Resumo automático gerado ao final do dia.",
                color: 0x5865F2,
                fields: [{ name: "👥 Total de Contratados", value: `\`\`\`${total} pessoas\`\`\``, inline: true }],
            }),
        },
        {
            channelId: '1491866020820811837',
            name: 'Entradas',
            buildEmbed: (total) => ({
                title: "📉 Relatório de Entradas",
                description: "Resumo de Entradas Diarias.",
                color: 0xED4245,
                fields: [{ name: "🚪 Total de Entradas", value: `\`\`\`${total} pessoas\`\`\``, inline: true }],
            }),
        },
        {
            channelId: '1491866065293283428',
            name: 'Saidas',
            buildEmbed: (total) => ({
                title: "📉 Relatório de Saídas",
                description: "Resumo de Saídas Diarias.",
                color: 0xED4245,
                fields: [{ name: "🚪 Total de Saídas", value: `\`\`\`${total} pessoas\`\`\``, inline: true }],
            }),
        },
    ];

    const counts = await Promise.all(
        reportsConfig.map(({ channelId }) =>
            prisma.discord.count({
                where: { channelId, createdAt: { gte: startOfDay, lte: endOfDay } },
            })
        )
    );

    for (let i = 0; i < reportsConfig.length; i++) {
        try {
            const channel = await client.channels.fetch(reportsConfig[i].channelId);
            await channel.send({
                embeds: [{
                    ...reportsConfig[i].buildEmbed(counts[i]),
                    timestamp: new Date(),
                    footer: { text: "Sistema automático • Bot Paraná Seguros" },
                }],
            });
            console.log(`📊 Relatório de ${reportsConfig[i].name} enviado (${counts[i]})`);
        } catch (erro) {
            console.log(`Problema ao enviar relatório ${reportsConfig[i].name}:`, erro);
        }
    }
}

async function processNotification(record) {
    const now = new Date();

    if (record.sent) return;

    if (record.firstSent && (!record.executeAt || new Date(record.executeAt) > now)) return;

    try {
        const channel = await client.channels.fetch(record.channelId);
        if (!channel || !channel.isTextBased()) return;

        const roleMention = `<@&${record.equipe || record.message}>`;
        if (record.channelId === '1493999520139448522') {
            await channel.send({
                content: roleMention,
                embeds: [{
                    title: "❇️ NOVO CONTRATADO",
                    description: `Um cliente acaba de ser contratado!`,
                    color: 0xFF0000,
                    fields: [
                        { name: "👤 Nome do Cliente", value: `\`\`\`${record.nome || "Não informado"}\`\`\``, inline: false },
                        { name: "📞 Telefone",         value: `\`\`\`${record.telefone || "Não informado"}\`\`\``, inline: false },
                    ],
                    timestamp: new Date(),
                    footer: { text: "Atualização automática do sistema" },
                }],
            });

            await prisma.discord.update({
                where: { id: record.id },
                data: { firstSent: true, sent: true },
            });

            console.log(`📨 Contratação enviada → ${record.nome || record.telefone}`);
            return;
        }

        if (!record.firstSent) {
            const msg = await channel.send({
                content: roleMention,
                embeds: [{
                    title: "📢 Novo Cliente Agendado",
                    description: `**${record.nome || "Cliente"}** com o telefone **${record.telefone}**\nNotificação agendada para daqui a **${record.hours || 0}h**.`,
                    color: 0x5865F2,
                    fields: [
                        { name: "👤 Nome",     value: `**${record.nome || "Não informado"}**`, inline: true },
                        { name: "📞 Telefone", value: record.telefone || "Não informado",       inline: true },
                        { name: "⏰ Prazo",    value: `${record.hours || 0}h`,                  inline: true },
                    ],
                    timestamp: new Date(),
                    footer: { text: "Notificação inicial • Reaja para marcar" },
                }],
            });

            await addReactions(msg);

            await prisma.discord.update({
                where: { id: record.id },
                data: { firstSent: true },
            });

            console.log(`📨 1ª mensagem enviada → ${record.nome || record.telefone}`);

            if (record.executeAt) {
                const delay = new Date(record.executeAt) - now;
                if (delay > 0) {
                    console.log(`⏳ 2ª mensagem agendada em ${Math.round(delay / 60000)} min → ${record.nome}`);
                    setTimeout(() => processNotification({ ...record, firstSent: true }), delay);
                }
            }
            return;
        }

        const msg = await channel.send({
            content: roleMention,
            embeds: [{
                title: "⏰ Lembrete de Prazo Expirado",
                description: `⚠️ **${record.nome || "Cliente"}** com o telefone **${record.telefone}**\nO prazo de ${record.hours || 0}h já expirou!`,
                color: 0xED4245,
                fields: [
                    { name: "👤 Nome",          value: `**${record.nome || "Não informado"}**`, inline: true },
                    { name: "📞 Telefone",       value: record.telefone || "Não informado",       inline: true },
                    { name: "⏰ Prazo Original", value: `${record.hours || 0}h`,                  inline: true },
                ],
                timestamp: new Date(),
                footer: { text: "Lembrete • Reaja para marcar" },
            }],
        });

        await addReactions(msg);

        await prisma.discord.update({
            where: { id: record.id },
            data: { sent: true },
        });

        console.log(`✅ 2ª mensagem enviada → ${record.nome || record.telefone}`);

    } catch (err) {
        console.error(`Erro ao processar notificação ${record.id}:`, err);
    }
}

async function addReactions(discordMessage) {
    try {
        await discordMessage.react("✅");
        await discordMessage.react("❌");
    } catch (err) {
        console.error("Erro ao adicionar reações:", err);
    }
}

async function startListener() {
    let pgClient;

    async function connect() {
        try {
            pgClient = await createListenerConnection();

            await pgClient.query('LISTEN discord_changes');
            console.log("👂 Escutando mudanças no banco...");

            pgClient.on('notification', async (msg) => {
                try {
                    const record = JSON.parse(msg.payload);
                    console.log(`🔔 Mudança detectada → id: ${record.id}`);
                    await processNotification(record);
                } catch (err) {
                    console.error("Erro ao processar notificação do banco:", err);
                }
            });

            pgClient.on('error', async (err) => {
                console.error("❌ Erro na conexão do listener:", err.message);
                await reconnect();
            });

        } catch (err) {
            console.error("Falha ao conectar listener:", err.message);
            await reconnect();
        }
    }

    async function reconnect() {
        console.log("🔁 Reconectando listener em 5s...");
        try { await pgClient?.end(); } catch (_) {}
        setTimeout(connect, 5000);
    }

    await connect();
}

export async function startWorker() {
    console.log("🔥 Worker iniciado");

    scheduleNextReport();
    await startListener();
}