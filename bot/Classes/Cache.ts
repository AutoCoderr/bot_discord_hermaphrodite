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

export function setUserInCache(user) {
    if (userCache[user.id] == undefined) userCache[user.id] = user;
}