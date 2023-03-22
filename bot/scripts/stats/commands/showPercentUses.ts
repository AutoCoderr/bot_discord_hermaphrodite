import { round } from "../../../Classes/OtherFunctions";
import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import getServerConfigResources, { IConfigResourceKey, configResourcesKeys } from "../../../libs/stats/getServersConfigResources";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_show_percent_uses <servers: all|server_id1, server_id2, server_idn> / <keys: all|key1, key2, key2>");
    console.log("Les clés possibles : "+Object.keys(configResourcesKeys).join(", "))
    process.exit();
}

client.on('ready', async () => {
    const {ids, keys} = (process.argv.slice(2)).reduce(({ids,keys,inKeys},arg) => ({
        ids: (inKeys || arg === "/") ? ids : [...ids, arg],
        keys: (inKeys && arg !== "/") ? [...keys, arg] : keys,
        inKeys: inKeys || arg === "/"
    }), <{ids: string[], keys: IConfigResourceKey[], inKeys: boolean}>{ids: [], keys: [], inKeys: false})

    if ((keys.length !== 1 || keys[0] !== "all") && (keys.length === 0 || keys.some(key => configResourcesKeys[key] === undefined)))
        throw cmdError("Vous devez rentrer au moins une clé valide");

    const guilds = checkAndGetGivenGuilds(ids, client, cmdError);

    const serverConfigs = await getServerConfigResources((keys.length === 1 && keys[0] === "all" ? null : keys),guilds);

    console.log("Voici les différents usages pour les serveurs suivants :");
    console.log("\n"+guilds.map(({name,id}) => name+" ("+id+")").join("\n")+"\n\n")
    console.log(
        Object.entries(serverConfigs)
            .map(([key,servers]) => 
                "\t"+key+" : "+round(Object.values(servers).filter(value => value).length/guilds.length*100, 2)+"% of uses"
            ).join("\n")
    )

    process.exit();
});