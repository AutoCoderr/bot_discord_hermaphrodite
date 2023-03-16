import { Guild } from "discord.js";
import MessagesStats from "../../Models/Stats/MessagesStats";
import VocalConnectionsStats from "../../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats from "../../Models/Stats/VocalMinutesStats";
import VocalNewConnectionsStats from "../../Models/Stats/VocalNewConnectionsStats";

export default function purgeDatas(guilds: Guild[], type: 'vocal'|'messages', specifiedDate: Date, afterOrBefore: 'after'|'before') {
    const models = type === "vocal" ? [VocalConnectionsStats, VocalNewConnectionsStats, VocalMinutesStats] : [MessagesStats]
    const guildsIds = guilds.map(({id}) => id);

    return Promise.all(
        models.map(model =>
            model.deleteMany({
                serverId: {$in: guildsIds},
                date: {[afterOrBefore === "after" ? "$gte" : "$lt"]: specifiedDate}
            })    
        )
    )
}