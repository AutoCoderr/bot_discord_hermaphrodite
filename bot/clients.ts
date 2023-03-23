import Discord, {ClientEvents, GatewayIntentBits} from "discord.js";
import config from "./config";

const listenEvents = (clients: Discord.Client[]) => 
    (event: keyof ClientEvents, callback: ((...args: any[]) => any)) => {
        for (const client of clients) {
            client.on(event, (...args) => callback(...args))
        }
    }

let readyClients: null|Discord.Client<true>[] = null;

export function getReadyClients(): Discord.Client<true>[] {
    if (readyClients === null) {
        throw new Error("Ready clients are not ready !")
    }
    return readyClients;
}

export function findGuildOnClients(serverId: string) {
    for (const client of getReadyClients()) {
        const guild = client.guilds.cache.get(serverId);
        if (guild)
            return guild;
    }
    return undefined
}

export function connectClients() {
    return Promise.all(
        config.tokens.map(token => new Promise(resolve => {
            const client = new Discord.Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.GuildMembers,
                    GatewayIntentBits.GuildPresences,
                    GatewayIntentBits.GuildMessageReactions,
                    GatewayIntentBits.GuildVoiceStates,
                    GatewayIntentBits.MessageContent
                ]
            })
            client.login(token);
            client.on('ready', () => resolve(client))
        })
    )).then((clients) => {
        readyClients = clients
        return listenEvents(clients);
    })
}
