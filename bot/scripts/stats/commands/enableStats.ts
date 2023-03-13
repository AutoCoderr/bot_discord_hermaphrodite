import { Guild } from "discord.js";
import client from "../../../client";
import StatsConfig, { IStatsConfig } from "../../../Models/Stats/StatsConfig";

function error(msg) {
    console.log("Error : "+msg);
    console.log("There is the needed syntax :");
    console.log("npm run stats_enable <vocal|messages> <all|server_id1, server_id2, server_idn>");
    process.exit();
}

client.on('ready', async () => {
    const type = process.argv[2];

    if (!["vocal","messages"].includes(type))
        throw error("Vous devez préciser s'il s'agit du vocal ou des messages");

    const ids = process.argv.slice(3);

    if (ids.length === 0)
        throw error("Vous devez mentionner soit 'all' soit une liste d'id de serveurs")

    const all = ids.length === 1 && ids[0] === "all";

    const guilds: (Guild)[] = all ?
        Array.from(client.guilds.cache.values()):
        ids.map(id => {
            const guild = client.guilds.cache.get(id);
            if (guild === undefined)
                throw error("The guild '"+id+"' does not exist");
            
            return guild
        });
    
    const statsConfigsByServerId: {[serverId: string]: IStatsConfig} = await StatsConfig.find({
        serverId: {$in: guilds.map(({id}) => id)}
    }).then(statsConfigs => statsConfigs.reduce((acc,statsConfig) => ({
        ...acc,
        [statsConfig.serverId]: statsConfig
    }), {}))

    
    await Promise.all(
        guilds.map(async guild => {
            const statsConfig = statsConfigsByServerId[guild.id] ?? null;

            if (statsConfig === null) {
                return StatsConfig.create({
                    serverId: guild.id,

                })
            }
        })
    )

})