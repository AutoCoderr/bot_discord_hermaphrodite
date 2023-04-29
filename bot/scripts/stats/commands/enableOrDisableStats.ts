import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import { getStatsConfigsByGuildsIds } from "../../../libs/stats/statsCommandUtils";
import StatsConfig from "../../../Models/Stats/StatsConfig";

function cmdError(msg, action) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_"+action+" <type: vocal|messages> <servers: default|all|server_id1, server_id2, server_idn>");
    process.exit();
}

client.on('ready', async () => {
    const [action, type] = process.argv.slice(2);

    if (!["enable","disable"].includes(action))
        throw new Error("'action' has not been correctly given")

    if (!["vocal","messages"].includes(type))
        throw cmdError("Vous devez préciser s'il s'agit du vocal ou des messages",action);

    const ids = process.argv.slice(4);

    const guilds = checkAndGetGivenGuilds(ids, client, (msg) => cmdError(msg,action), true)

    const statsConfigsByServerId = await getStatsConfigsByGuildsIds(guilds.map(({id}) => id));

    const isDefault = guilds[0] && guilds[0].id === "default";

    if (isDefault) {
        console.log(
            "Tout les nouveaux serveurs auront par défaut leurs stats "+
            (type === "vocal" ? "vocales" : "textuelles")+
            " "+(action === "enable" ? "activées" : "désactivées")
        )
    } else {
        console.log(
            "Les guilds suivants vont avoir leurs stats "+
            (type === "vocal" ? "vocales" : "textuelles")+
            " "+(action === "enable" ? "activées" : "désactivées")+" :"
        );
        console.log("\n"+guilds.map(({name,id}) => name+" ("+id+")").join("\n")+"\n")
    }
        
    
    const enabledCol = type === 'messages' ? 'listenMessages' : 'listenVocal';
    const activePeriodCol = type === 'messages' ? 'messagesActivePeriods' : 'vocalActivePeriods';
    
    await Promise.all(
        guilds.map(async guild => {
            const statsConfig = statsConfigsByServerId[guild.id] ?? null;

            if (statsConfig === null) {
                if (action === "enable")
                    await StatsConfig.create({
                        serverId: guild.id,
                        [enabledCol]: true,
                        [activePeriodCol]: isDefault ? [] : [{
                            startDate: new Date()
                        }]
                    })
                return;
            }

            if ((action === "enable") === statsConfig[enabledCol])
                return;

            statsConfig[enabledCol] = action === "enable";
            if (action === "enable" && !isDefault) {
                statsConfig[activePeriodCol] = [
                    {
                        startDate: new Date()
                    },
                    ...(statsConfig[activePeriodCol]??[])
                ]
            } else if (!isDefault){
                statsConfig[activePeriodCol][0].endDate = new Date();
            }
            await statsConfig.save();
        })
    )
    console.log(
        (isDefault ? "Valeur par défaut des stats " : "Stats")+(type === "vocal" ? "vocales" : "textuelles")+
        " "+(action === "enable" ? "activées" : "désactivées")+" avec succès!"
    );
    process.exit()
})