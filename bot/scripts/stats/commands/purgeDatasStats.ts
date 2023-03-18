import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import { getDateTag } from "../../../libs/stats/exportStatsInCsv";
import purgeDatas from "../../../libs/stats/purgesDatas";
import { getDateWithPrecision } from "../../../libs/stats/statsCounters";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_purge <type: vocal|messages> <date> <after|before> <servers: all|server_id1, server_id2, server_idn>");
    process.exit();
}

client.on("ready", async () => {
    const [type,date,afterOrBefore] = <['vocal'|'messages',string,'after'|'before']>process.argv.slice(2);

    if (!["vocal","messages"].includes(type))
        throw cmdError("Vous devez préciser s'il s'agit du vocal ou des messages");
    
    let specifiedDate = new Date(date);
    if (isNaN(specifiedDate.getTime()))
        throw cmdError("Vous devez mentionner une date valide");

    specifiedDate = getDateWithPrecision(specifiedDate);

    if (!['after','before'].includes(afterOrBefore))
        throw cmdError("Vous voulez purger les stats depuis ou avant le "+getDateTag(specifiedDate, 'hour')+" ?");
    
    const ids = process.argv.slice(5);

    const guilds = checkAndGetGivenGuilds(ids,client,cmdError);

    console.log(
        "Les guilds suivants vont avoir leurs stats "+
        (type === "vocal" ? "vocales" : "textuelles")+" purgées :"
    );
    console.log("\n"+guilds.map(({name,id}) => name+" ("+id+")").join("\n")+"\n")

    await purgeDatas(guilds, type, specifiedDate, afterOrBefore)

    console.log("Données purgées !");
    process.exit();
});