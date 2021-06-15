import Discord from "discord.js";

export default new Discord.Client({ws:{intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS", "GUILD_PRESENCES"]}});
