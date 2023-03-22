import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import getServerConfigResources, { IConfigResourceKey, IExportedServerConfigResources, configResourcesKeys } from "../../../libs/stats/getServersConfigResources";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_show_servers <servers: all|server_id1, server_id2, server_idn> [/ <keys: all|key1, key2, key2> ]");
    console.log("Les clés possibles : "+Object.keys(configResourcesKeys).join(", "))
    process.exit();
}

client.on('ready', async () => {
    const {ids, keys} = (process.argv.slice(2)).reduce(({ids,keys,inKeys},arg) => ({
        ids: (inKeys || arg === "/") ? ids : [...ids, arg],
        keys: (inKeys && arg !== "/") ? [...keys, arg] : keys,
        inKeys: inKeys || arg === "/"
    }), <{ids: string[], keys: IConfigResourceKey[], inKeys: boolean}>{ids: [], keys: [], inKeys: false})

    if ((keys.length !== 1 || keys[0] !== "all") && keys.some(key => configResourcesKeys[key] === undefined))
        throw cmdError("Vous devez rentrer des clés valides");

    const guilds = checkAndGetGivenGuilds(ids, client, cmdError);

    const serverConfigs: null|IExportedServerConfigResources = keys.length > 0 ? await getServerConfigResources((keys.length === 1 && keys[0] === "all" ? null : keys),guilds) : null;

    console.log("Voici les différents serveurs :"+(keys.length > 0 ? "\n\n" : "\n"));
    console.log(
        guilds.map(({id,name}) => 
            name+" ("+id+")"+ (
                keys.length > 0 ?
                    " => \n"+Object.entries(<IExportedServerConfigResources>serverConfigs).map(([key,servers]) =>
                        "\t"+key+" : "+(servers[id] ? "activé" : "désactivés")
                    ).join("\n") :
                    ""
            )
        ).join(keys.length > 0 ? "\n\n" : "\n")
    )

    process.exit();
});