import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import getServerConfigResources, { IConfigResourceKey, configResourcesKeys } from "../../../libs/stats/getServersConfigResources";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_show_servers <servers: all|server_id1, server_id2, server_idn> [/ key1, key2, key2]");
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

    //console.log({ids,keys})
    /*const {ids, keyss} = process.argv.slice(2).reduce(({ids,keyss,inKeys},arg) => ({
        ids: inKeys ? [] : [...ids, arg],
        keyss: [],
        inKeys: true
    }), <[ids: string[], keyss: IConfigResourceKey[], inKeys: boolean]>)*/

    console.log(await getServerConfigResources((keys.length === 1 && keys[0] === "all" ? null : keys),guilds))

    process.exit();
});