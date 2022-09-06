import {
    DMChannel, Emoji, Guild,
    GuildChannel, GuildMember,
    Message,
    ThreadChannel, User,
    VoiceChannel, VoiceState
} from "discord.js";
import {IReportedErrorData} from "./CustomError";
import {format} from "winston";
const {printf} = format

function extractObjectData<TObj>(obj: TObj, keys: (keyof TObj)[], getters: {[key in keyof TObj]?: (value: TObj[key]) => any} = {}) {
    return Object.entries(obj)
        .filter(([key]) => keys.includes(<keyof TObj>key))
        .reduce((acc,[key,value]) => ({
            ...acc,
            [key]: getters[key] ? getters[key](value) : value
        }), {})
}

const channelFormatterWithNameAndParent = (channel: GuildChannel|VoiceChannel|ThreadChannel) =>
    extractObjectData(channel, ['id','name','type','createdAt','parent'], {
        parent: (parent) => parent ? extractObjectData(parent, ['id','name','type']) : null
    })
const channelFormatterWithoutNameAndParent = (channel: DMChannel) =>
    extractObjectData(channel, ['id','type','createdAt'])

const channelTypesWithNameAndParent = [GuildChannel,VoiceChannel,ThreadChannel].reduce((acc,channelClass) => ({
    ...acc,
    [channelClass.name]: channelFormatterWithNameAndParent
}), {})

const channelTypesWithoutNameAndParent = [DMChannel].reduce((acc,channelClass) => ({
    ...acc,
    [channelClass.name]: channelFormatterWithNameAndParent
}), {})

const formatByType = {
    [User.name]: (user: User) => extractObjectData(user, ['id','username']),
    [GuildMember.name]: (member: GuildMember) => ({
        ...extractObjectData(member,['id','guild','deleted','moderatable','manageable','kickable','pending','roles'], {
            roles: (roles) => Array.from(roles.cache.values()).map(role => extractObjectData(role, ['id','name'])),
            guild: (guild) => extractObjectData(guild, ['id'])
        }),
        username: member.nickname??member.user.username
    }),
    [VoiceState.name]: (voiceState: VoiceState) => extractObjectData(voiceState, ['id','sessionId','channelId']),
    [Guild.name]: (guild: Guild) => extractObjectData(guild, ['id','name','description','memberCount','available','deleted']),
    [Message.name]: (message: Message) => extractObjectData(message, ['id','channelId','guildId','content','createdAt','editedAt','deleted','deletable','editable','tts','type','system']),


    ...channelTypesWithNameAndParent,
    ...channelFormatterWithoutNameAndParent,


    [Emoji.name]: (emote: Emoji) => extractObjectData(emote, ['id','name','animated','createdAt','deleted']),
    commandArguments: (args: {[key: string]: any}) => Object.entries(args).reduce((acc,[key,value]) => ({
        ...acc,
        [key]: formatByType[value.constructor.name] ? formatByType[value.constructor.name](value) : value
    }), {})
}

const logFormatter = printf(({level, message, stack, data}: {level: string, message: string, stack?: string, data?: IReportedErrorData}) => JSON.stringify({
    level,
    message,
    stack: stack ? stack.split("\n") : null,
    data: data ? Object.entries(data).reduce((acc,[key,value]) => ({
        ...acc,
        [key]: key === 'commandArguments' ?
            formatByType.commandArguments(value) :
            formatByType[value.constructor.name] ?
                formatByType[value.constructor.name](value) :
                value
    }), {}) : null
}, null, '\t'));

export default logFormatter;