import client from "../../../client";
import StatsConfig, { IStatsConfig } from "../../../Models/Stats/StatsConfig";

function cmdError(msg, enableOrDisable) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_"+enableOrDisable+" <vocal|messages> <all|server_id1, server_id2, server_idn>");
    process.exit();
}

client.on('ready', async () => {
    const [enableOrDisable, type] = process.argv.slice(2);

    if (!["enable","disable"].includes(enableOrDisable))
        throw new Error("'enableOrDisable' has not been correctly given")

    if (!["vocal","messages"].includes(type))
        throw cmdError("Vous devez préciser s'il s'agit du vocal ou des messages",enableOrDisable);

    const ids = process.argv.slice(4);

    if (ids.length === 0)
        throw cmdError("Vous devez mentionner soit 'all' soit une liste d'id de serveurs",enableOrDisable)

    const all = ids.length === 1 && ids[0] === "all";

    const guildsIds: (string)[] = all ?
        Array.from(client.guilds.cache.keys()):
        ids.map(id => {
            const guild = client.guilds.cache.get(id);
            if (guild === undefined)
                throw cmdError("The guild '"+id+"' does not exist",enableOrDisable);
            
            return guild.id
        });

    console.log(
        "Les guilds suivants vont avoir leur stats "+
        (type === "vocal" ? "vocales" : "de messages")+
        " "+(enableOrDisable === "enable" ? "activées" : "désactivées")+" :"
    );
    console.log("\n"+guildsIds.join("\n")+"\n")
    
    const statsConfigsByServerId: {[serverId: string]: IStatsConfig} = await StatsConfig.find({
        serverId: {$in: guildsIds}
    }).then(statsConfigs => statsConfigs.reduce((acc,statsConfig) => ({
        ...acc,
        [statsConfig.serverId]: statsConfig
    }), {}))

    
    await Promise.all(
        guildsIds.map(async guildId => {
            const statsConfig = statsConfigsByServerId[guildId] ?? null;

            if (statsConfig === null) {
                if (enableOrDisable === "enable")
                    await StatsConfig.create({
                        serverId: guildId,
                        [type === 'messages' ? 'listenMessages' : 'listenVocal']: enableOrDisable === "enable"
                    })
                return;
            }

            statsConfig[type === 'messages' ? 'listenMessages' : 'listenVocal'] = enableOrDisable === "enable";
            await statsConfig.save();
        })
    )
    console.log(
        "Stats "+(type === "vocal" ? "vocales" : "de messages")+
        " "+(enableOrDisable === "enable" ? "activées" : "désactivées")+" avec succès!"
    );
    process.exit()
})