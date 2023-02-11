import { Guild } from "discord.js";
import client from "../../client";
import checkExistingResources from "./checkExistingResources";
import config from "./config";
import prepareVocalAndText from "./prepareVocalAndText";
import prepareXP from "./prepareXP";

client.on('ready', async () => {
    const guilds: Guild[] = await checkExistingResources(config);
    await prepareVocalAndText(config,'vocal');
    await prepareVocalAndText(config,'text');
    await prepareXP(config,guilds);

    console.log("Spam config generation finished")
    process.exit()
})