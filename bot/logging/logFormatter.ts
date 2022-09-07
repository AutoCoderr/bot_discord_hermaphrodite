import {
    DMChannel, Emoji, Guild,
    GuildChannel, GuildMember,
    Message, TextChannel,
    ThreadChannel, User,
    VoiceChannel, VoiceState
} from "discord.js";
import {IReportedErrorData} from "./CustomError";
import {format} from "winston";
import ticketConfig, {ITicketConfig} from "../Models/TicketConfig";
import TicketConfig from "../Models/TicketConfig";
const {printf} = format

function extractObjectData<TObj>(obj: TObj, keys: (keyof TObj)[], getters: {[key in keyof TObj]?: (value: TObj[key]) => any} = {}) {
    if (obj === null || obj === undefined)
        return obj;
    return [...Object.keys(obj), ...Object.keys(Object.getOwnPropertyDescriptors((<Object>obj).constructor.prototype))]
        .filter((key) => keys.includes(<keyof TObj>key))
        .reduce((acc,key) => ({
            ...acc,
            [key]: getters[key] ? getters[key](obj[key]) : obj[key]
        }), {})
}

const channelFormatterWithNameAndParent = (channel: TextChannel|GuildChannel|VoiceChannel|ThreadChannel) =>
    extractObjectData(channel, ['id','guildId','name','type','createdAt','parent'], {
        parent: (parent) => parent ? extractObjectData(parent, ['id','name','type']) : null
    })
const channelFormatterWithoutNameAndParent = (channel: DMChannel) =>
    extractObjectData(channel, ['id','type','createdAt'])

const channelTypesWithNameAndParent = [TextChannel,GuildChannel,VoiceChannel,ThreadChannel].reduce((acc,channelClass) => ({
    ...acc,
    [channelClass.name]: channelFormatterWithNameAndParent
}), {})

const channelTypesWithoutNameAndParent = [DMChannel].reduce((acc,channelClass) => ({
    ...acc,
    [channelClass.name]: channelFormatterWithoutNameAndParent
}), {})

const formatByType = {
    [User.name]: (user: User) => extractObjectData(user, ['id','username']),
    [GuildMember.name]: (member: GuildMember) => ({
        ...extractObjectData(member,['id','user','guild','bannable','moderatable','manageable','kickable','pending','roles'], {
            roles: (roles) => Array.from(roles.cache.values()).map(role => extractObjectData(role, ['id','name'])),
            guild: (guild) => extractObjectData(guild, ['id']),
            user: (user) => extractObjectData(user, ['id','username'])
        }),
        username: member.nickname??member.user.username
    }),
    [VoiceState.name]: (voiceState: VoiceState) => extractObjectData(voiceState, ['id','sessionId','channelId']),
    [Guild.name]: (guild: Guild) => extractObjectData(guild, ['id','name','description','memberCount','available']),
    [Message.name]: (message: Message) => extractObjectData(message, ['id','channelId','guildId','content','createdAt','editedAt','deletable','editable','tts','type','system']),


    ...channelTypesWithNameAndParent,
    ...channelTypesWithoutNameAndParent,


    [Emoji.name]: (emote: Emoji) => extractObjectData(emote, ['id','name','animated','createdAt']),

    [Array.name]: (elems: any[]) => elems.map(elem =>
        (elem !== null && elem !== undefined && formatByType[elem.constructor.name]) ?
            formatByType[elem.constructor.name](elem) :
            elem
    ),

    commandArguments: (args: {[key: string]: any}) => Object.entries(args).reduce((acc,[key,value]) => ({
        ...acc,
        [key]: formatByType[value.constructor.name] ? formatByType[value.constructor.name](value) : value
    }), {}),
    ticketConfig: (ticketConfig: typeof TicketConfig) => extractObjectData(ticketConfig._doc, ['_id','enabled','categoryId','moderatorId','serverId','ticketChannels'])
}

const logFormatter = printf(({level, message, stack, data}: {level: string, message: string, stack?: string, data?: IReportedErrorData}) => JSON.stringify({
    level,
    message,
    stack: stack ? stack.split("\n") : null,
    data: data ? Object.entries(data).sort().reduce((acc,[key,value]) => ({
        ...acc,
        [key]: (value === undefined || value === null) ? value :
            formatByType[key] ?
                formatByType[key](value) :
                formatByType[value.constructor.name] ?
                    formatByType[value.constructor.name](value) :
                    value
    }), {}) : null
}, null, '\t'));

export default logFormatter;