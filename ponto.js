import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export function setupPointSystem(client) {
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const userId = interaction.user.id;
        const today = new Date().toLocaleDateString("sv-SE");

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

        // START
        if (interaction.customId === "point_start") {
            if (session.isActive) {
                return interaction.reply({
                    content: "⚠️ Você já iniciou o ponto hoje.",
                    ephemeral: true,
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

            return interaction.reply({
                content: "✅ Ponto iniciado!",
                ephemeral: true,
            });
        }

        // STOP
        if (interaction.customId === "point_stop") {
            if (!session.isActive) {
                return interaction.reply({
                    content: "⚠️ Você não iniciou ainda.",
                    ephemeral: true,
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

            return interaction.reply({
                content: "🏁 Ponto finalizado!",
                ephemeral: true,
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