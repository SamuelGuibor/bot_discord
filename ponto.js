import { prisma } from "./db.js";

const safeReply = async (interaction, options) => {
    if (interaction.replied || interaction.deferred) return;
    try {
        await interaction.reply(options);
    } catch {}
};

export function setupPointSystem(client) {
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "point_start" && interaction.customId !== "point_stop") return;

        const userId = interaction.user.id;
        const today = new Date().toLocaleDateString("sv-SE");

        try {
            let session = await prisma.workSession.findUnique({
                where: {
                    discordId_date: {
                        discordId: userId,
                        date: today,
                    },
                },
            });

            if (!session) {
                session = await prisma.workSession.create({
                    data: {
                        discordId: userId,
                        userId: userId,
                        date: today,
                    },
                });
            }

            if (interaction.customId === "point_start") {
                if (session.isActive) {
                    return safeReply(interaction, {
                        content: "⚠️ Você já iniciou o ponto hoje.",
                        flags: 64,
                    });
                }

                await prisma.workSession.update({
                    where: { id: session.id },
                    data: {
                        startedAt: new Date(),
                        isActive: true,
                        isPaused: false,
                    },
                });

                await sendLog(interaction, "🟢 INÍCIO");

                return safeReply(interaction, {
                    content: "✅ Ponto iniciado!",
                    flags: 64,
                });
            }

            if (interaction.customId === "point_stop") {
                if (!session.isActive) {
                    return safeReply(interaction, {
                        content: "⚠️ Você não iniciou ainda.",
                        flags: 64,
                    });
                }

                await prisma.workSession.update({
                    where: { id: session.id },
                    data: {
                        finishedAt: new Date(),
                        isActive: false,
                        isPaused: false,
                    },
                });

                await sendLog(interaction, "🔴 FINALIZADO");

                return safeReply(interaction, {
                    content: "🏁 Ponto finalizado!",
                    flags: 64,
                });
            }
        } catch (err) {
            console.error("Erro no handler de ponto:", err);
            safeReply(interaction, {
                content: "❌ Ocorreu um erro ao registrar o ponto. Tente novamente.",
                flags: 64,
            });
        }
    });
}

async function sendLog(interaction, type) {
    const logChannelId = process.env.DISCORD_LOG_CHANNEL;
    const channel = await interaction.client.channels.fetch(logChannelId);

    await channel.send({
        content: `
📋 **Registro de Ponto**
👤 Usuário: ${interaction.user.tag}
📌 Ação: ${type}
🕒 Horário: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", })}
    `,
    });
}