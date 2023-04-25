import { isNumber } from "../../../Classes/OtherFunctions";
import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import clearExpiredDatas from "../../../libs/stats/clearExpiredDatas";
import { getStatsConfigsByGuildsIds } from "../../../libs/stats/statsCommandUtils";
import StatsConfig, { defaultStatsExpiration, maxStatsExpiration, minStatsExpiration } from "../../../Models/Stats/StatsConfig";

function cmdError(msg, action) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_expiration_"+action+" <type: vocal|messages>"+(action === "set" ? " <expiration: integer>" : "")+" <server: default|all|server_id1, server_id2, server_idn>");
    process.exit();
}

client.on('ready', async () => {
    const [action,type,expiration] = process.argv.slice(2);

    if (!["set","show"].includes(action))
        throw new Error("'action' has not been correctly given");

    if (!["vocal","messages"].includes(type))
        throw cmdError("Vous devez préciser s'il s'agit du vocal ou des messages",action);

    let parsedExpiration;
    if (
        action === "set" && (
            !isNumber(expiration) || 
            (parsedExpiration = parseInt(expiration)) && (
                parsedExpiration < minStatsExpiration ||
                parsedExpiration > maxStatsExpiration
            )
        )
    )
        throw cmdError("Vous devez mentionner pour l'expiration un entier situé entre "+minStatsExpiration+" et "+maxStatsExpiration+" jours inclus", action)
    
    const ids = process.argv.slice(action === "set" ? 5 : 4);

    const guilds = checkAndGetGivenGuilds(ids, client, (msg) => cmdError(msg,action), true);

    const statsConfigsByServerId = await getStatsConfigsByGuildsIds(guilds.map(({id}) => id));

    const isDefault = guilds.length === 1 && guilds[0].id === "default";

    if (action === "show") {
        if (isDefault) {
            console.log("Voici l'expiration par défaut des stats "+(type === 'messages' ? 'textuelles' : 'vocales')+" : \n");
            console.log((
                statsConfigsByServerId.default ? 
                    statsConfigsByServerId.default[type === "vocal" ? "vocalExpiration" : "messagesExpiration"] :
                    defaultStatsExpiration
                )+" jours"
            )
            process.exit()
        }

        console.log("Voici l'expiration des stats "+(type === 'messages' ? 'de messages' : 'vocales')+" des serveurs mentionnés :")
        console.log("\n"+
            guilds.map(({name,id}) =>
                name+" ("+id+") => "+(
                    statsConfigsByServerId[id] ? 
                        statsConfigsByServerId[id][type === "vocal" ? "vocalExpiration" : "messagesExpiration"] :
                        defaultStatsExpiration
                    )+" jours"
            ).join("\n")
        )
        process.exit();
    }


    console.log(
        isDefault ?
            "La valeur d'expiration par défaut des stats "+(type === "vocal" ? "vocales" : "de messages")+
            " va être défini à "+parsedExpiration+" jours" :

            "Les guilds suivants vont avoir leur expiration de stats "+
            (type === "vocal" ? "vocales" : "de messages")+" définis à "+parsedExpiration+" jours :"
    );
    if (!isDefault)
        console.log("\n"+guilds.map(({name,id}) => name+" ("+id+")").join("\n")+"\n")

    await Promise.all(
        guilds.map(async guild => {
            const statsConfig = statsConfigsByServerId[guild.id] ?? null;

            if (statsConfig === null) {
                await StatsConfig.create({
                    serverId: guild.id,
                    [type === 'messages' ? 'messagesExpiration' : 'vocalExpiration']: parsedExpiration
                })
            } else {
                statsConfig[type === 'messages' ? 'messagesExpiration' : 'vocalExpiration'] = parsedExpiration;
                await statsConfig.save();
            }

            if (isDefault)
                return;

            if (type === "messages")
                await clearExpiredDatas("messages", guild.id)
            else
                await Promise.all(
                    ["vocalMinutes","vocalConnections","vocalNewConnections"]
                        .map(type => clearExpiredDatas(<'vocalMinutes'|'vocalConnections'|'vocalNewConnections'>type, guild.id))
                )
        })
    )

    console.log("Expiration définie avec succès !")
    process.exit();
})