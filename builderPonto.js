import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function buildPointButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("point_start")
      .setLabel("🟢 Iniciar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("point_stop")
      .setLabel("🔴 Finalizar")
      .setStyle(ButtonStyle.Danger)
  );
}

