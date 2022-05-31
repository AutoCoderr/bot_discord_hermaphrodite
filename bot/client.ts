import Discord from "discord.js";
import config from "./config";

const client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS", "GUILD_PRESENCES", "GUILD_MESSAGE_REACTIONS","GUILD_VOICE_STATES"]});

client.login(config.token);

export default client
