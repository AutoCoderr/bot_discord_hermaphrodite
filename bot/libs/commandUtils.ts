import Discord, { Guild } from "discord.js";

export function checkAndGetGivenGuilds(ids: string[], client: Discord.Client, cmdError: ((msg: string) => any)): Guild[] {
    if (ids.length === 0)
        throw cmdError("Vous devez mentionner soit 'all' soit une liste d'id de serveurs")

    const all = ids.length === 1 && ids[0] === "all";

    return all ?
        Array.from(client.guilds.cache.values()):
        ids.map(id => {
            const guild = client.guilds.cache.get(id);
            if (guild === undefined)
                throw cmdError("Le guild '"+id+"' n'existe pas");
            
            return guild
        });
}