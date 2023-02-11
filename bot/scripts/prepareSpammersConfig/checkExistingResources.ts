import { Guild } from "discord.js";
import client from "../../client";
import { IConfig } from "./interfaces";

export default function checkExistingResources(config: IConfig): Promise<Guild[]> {
    return Promise.all(
        (config.servers instanceof Array ? config.servers : [config.servers])
            .map(async server => {
                const guild: Guild|undefined = client.guilds.cache.get(server.id);
                if (guild === undefined)
                    throw new Error("Guild '"+server.id+"' not found");

                for (const spammerId of server.spammersIds) {
                    await guild.members.fetch(spammerId)
                        .catch(() => {throw new Error("Member '"+spammerId+"' not found on server '"+guild.name+"' ("+server.id+")")})
                }
                return guild;
            })
    )
}