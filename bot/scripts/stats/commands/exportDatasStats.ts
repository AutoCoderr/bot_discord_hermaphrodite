import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import exportStatsInCsv, { getDateTag, IExportType } from "../../../libs/stats/exportStatsInCsv";
import { getDateWithPrecision, IPrecision } from "../../../libs/stats/statsCounters";
import fs from "fs/promises";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log(
        "npm run stats_export <type: vocal|messages> <exportType: default|sum|avg|max|min>"+
        " <precision: hour|day|month> <date> <after|before> <server: all|server_id1, server_id2, server_idn>");
    process.exit();
}


client.on('ready', async () => {
    const [type, exportType, precision, date, afterOrBefore] = <['vocal'|'messages',IExportType,IPrecision,string,'after'|'before']>process.argv.slice(2);
    
    if (!["vocal","messages"].includes(type))
        throw cmdError("Vous devez préciser s'il s'agit du vocal ou des messages");

    if (!["default","sum","avg","max","min"].includes(exportType))
        throw cmdError("Vous devez préciser un type d'export valide");

    if (!["hour","day","month"].includes(precision))
        throw cmdError("Vous devez mentionner une precision valide");
    
    let specifiedDate = new Date(date);
    if (isNaN(specifiedDate.getTime()))
        throw cmdError("Vous devez mentionner une date valide");
    
    specifiedDate = getDateWithPrecision(specifiedDate, precision)

    if (!["after","before"].includes(afterOrBefore))
        throw cmdError("Vous voulez récupérer les stats depuis ou avant le "+getDateTag(specifiedDate, precision)+" ?");

    const ids = process.argv.slice(7);

    const guilds = checkAndGetGivenGuilds(ids, client, cmdError);

    const csvs = await exportStatsInCsv(
        guilds,
        exportType,
        specifiedDate,
        afterOrBefore,
        type,
        precision
    );
    
    const folderName = (new Date().toISOString())+"_"+type+"_"+getDateTag(specifiedDate, precision,"en")+"_"+afterOrBefore+"_"+precision+"_"+exportType;
    const path = __dirname+"/../../../exported_stats/"+folderName

    if (!(await fs.access(path).then(() => true).catch(() => false))) {
        await fs.mkdir(path);
    }
    for (const [key,csv] of Object.entries(csvs)) {
        await fs.writeFile(path+"/"+key+".csv", csv)
    }

    console.log("Stats exported in folder bot/exported_stats/"+folderName);
    process.exit();
})