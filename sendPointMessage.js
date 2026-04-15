import { EmbedBuilder } from "discord.js";
import { buildPointButtons } from "./builderPonto.js";

export async function sendPointPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor("#102347")
    .setTitle("📌 Controle de Ponto")
    .setDescription(
      "Use os botões abaixo para registrar suas ações do dia."
    )
    .addFields(
      {
        name: "🟢 Iniciar Expediente",
        value: "Registre o início do seu turno",
        inline: true,
      },
      {
        name: "🔴 Finalizar Expediente",
        value: "Registre o fim do seu turno",
        inline: true,
      }
    )
    .setFooter({
      text: "Sistema de ponto • Atualize diariamente",
    })
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    components: [buildPointButtons()],
  });
}