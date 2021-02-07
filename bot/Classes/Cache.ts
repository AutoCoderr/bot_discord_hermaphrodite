import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";

export const userCache = {};

export function getUserFromCache(id,bot) {
    if (userCache[id] == undefined) {
        const user = bot.users.cache.get(id);
        if (user != undefined) {
            setUserInCache(user);
        }
    }

    return userCache[id] ? userCache[id] : null;
}

export async function setUserInCache(user, server: any = null) {
    if (userCache[user.id] == undefined) {
        userCache[user.id] = user;
        if (server != null) {
            let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: server.id});
            if (ticketConfig == null) {
                ticketConfig = {
                    enabled: false,
                    categoryId: null,
                    blacklist: [],
                    whitelist: [user.id],
                    serverId: server.id
                }
                TicketConfig.create(ticketConfig);
            } else if (!ticketConfig.whitelist.includes(user.id)) {
                ticketConfig.whitelist.push(user.id); // @ts-ignore
                ticketConfig.save()
            }
        }
    }
}
