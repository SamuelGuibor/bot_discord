// reactions.js
import { prisma } from "./db.js";

export function setupReactionListener(client) {
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        if (!['❌', '✅'].includes(reaction.emoji.name)) return;

        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();

            const message = reaction.message;
            const channel = message.channel;

            const notification = await prisma.discord.findFirst({
                where: {
                    channelId: channel.id,
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!notification) return;

            if (reaction.emoji.name === "❌") {
                await prisma.discord.delete({
                    where: { id: notification.id }
                }).catch(() => {});

                await message.delete().catch(err => {
                    console.error("Erro ao deletar mensagem:", err);
                });

                console.log(`🗑️ Notificação deletada por ${user.tag} (ID: ${notification.id})`);
            }

            else if (reaction.emoji.name === "✅") {
                await prisma.discord.update({
                    where: { id: notification.id },
                    data: {
                        sent: true,
                        firstSent: true
                    }
                });
   
                await message.reply({ 
                    content: "✅ Marcado como visualizado." 
                });

                console.log(`✅ Notificação marcada como visualizada por ${user.tag}`);
            }

        } catch (err) {
            console.error("Erro no reaction handler:", err);
        }
    });
}