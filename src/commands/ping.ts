import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./types.js";

export const pingCommand: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  async execute(interaction) {
    const sent = await interaction.reply({ content: "Pinging…", fetchReply: true, ephemeral: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;
    await interaction.editReply(`Pong — roundtrip **${roundtrip}ms**, websocket **${ws}ms**.`);
  },
};

export default pingCommand;
