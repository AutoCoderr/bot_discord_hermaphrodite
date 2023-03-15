import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import { getStatsConfigsByGuildsIds } from "../../../libs/stats/statsCommandUtils";
import StatsConfig from "../../../Models/Stats/StatsConfig";

function cmdError(msg, action) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_"+action+" <type: vocal|messages> <servers: all|server_id1, server_id2, server_idn>");
    process.exit();
}

client.on('ready', async () => {
    const [action, type] = process.argv.slice(2);

    if (!["enable","disable","are_enabled"].includes(action))
        throw new Error("'action' has not been correctly given")

    if (!["vocal","messages"].includes(type))
        throw cmdError("Vous devez préciser s'il s'agit du vocal ou des messages",action);

    const ids = process.argv.slice(4);

    const guilds = checkAndGetGivenGuilds(ids, client, (msg) => cmdError(msg,action))

    const statsConfigsByServerId = await getStatsConfigsByGuildsIds(guilds.map(({id}) => id));

    if (action === "are_enabled") {
        console.log("Voici les serveurs ayant leur stats "+(type === "vocal" ? "vocales" : "textuelles")+" activées ou non :")
        console.log("\n"+
            guilds.map(({name,id}) =>
                name+" ("+id+") => "+(
                    statsConfigsByServerId[id] ? 
                        (statsConfigsByServerId[id][type === 'messages' ? 'listenMessages' : 'listenVocal'] ? "Activé" : "Désactivé") :
                        "Désactivé"
                    )
            ).join("\n")
        )
        process.exit();
    }

    console.log(
        "Les guilds suivants vont avoir leur stats "+
        (type === "vocal" ? "vocales" : "textuelles")+
        " "+(action === "enable" ? "activées" : "désactivées")+" :"
    );
    console.log("\n"+guilds.map(({name,id}) => name+" ("+id+")").join("\n")+"\n")
    
    await Promise.all(
        guilds.map(async guild => {
            const statsConfig = statsConfigsByServerId[guild.id] ?? null;

            if (statsConfig === null) {
                if (action === "enable")
                    await StatsConfig.create({
                        serverId: guild.id,
                        [type === 'messages' ? 'listenMessages' : 'listenVocal']: action === "enable"
                    })
                return;
            }

            statsConfig[type === 'messages' ? 'listenMessages' : 'listenVocal'] = action === "enable";
            await statsConfig.save();
        })
    )
    console.log(
        "Stats "+(type === "vocal" ? "vocales" : "textuelles")+
        " "+(action === "enable" ? "activées" : "désactivées")+" avec succès!"
    );
    process.exit()
})