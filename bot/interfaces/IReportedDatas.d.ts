import {
    DMChannel,
    Guild,
    GuildChannel,
    GuildMember,
    Message, Snowflake,
    TextBasedChannel,
    ThreadChannel,
    User,
    VoiceChannel, VoiceState
} from "discord.js";
import {ITextInvite} from "../Models/Text/TextInvite";
import {ITextAskInviteBack} from "../Models/Text/TextAskInviteBack";
import {IVocalInvite} from "../Models/Vocal/VocalInvite";
import {IVocalAskInviteBack} from "../Models/Vocal/VocalAskInviteBack";
import {IStoredNotifyOnReact} from "../Models/StoredNotifyOnReact";
import {IMonitoringMessage} from "../Models/MonitoringMessage";
import {IMessageToListen, ITicketConfig} from "../Models/TicketConfig";
import {IWelcomeMessage} from "../Models/WelcomeMessage";

export default interface IReportedData {
    from?: 'guildCreate'|
        'initSlashCommands'|
        'messageCreate'|
        'customCommand'|
        'slashCommand'|
        'vocalInvite'|
        'textInvite'|
        'vocalInviteBack'|
        'textInviteBack'|
        'voiceConnect'|
        'listeningNotifyOnReact'|
        'listeningMonitoring'|
        'initTicketMessageListening',
    guild?: Guild,
    message?: Message,
    user?: User|GuildMember,
    channel?: GuildChannel|VoiceChannel|ThreadChannel|DMChannel|TextBasedChannel,

    command?: string,
    commandId?: Snowflake,
    commandArguments?: {[key: string]: any},
    commandRawArguments?: {[key: string]: any},

    buttonData?: ITextInvite|ITextAskInviteBack|IVocalInvite|IVocalAskInviteBack,

    oldVoiceState?: VoiceState,
    newVoiceState?: VoiceState,

    storedNotifyOnReact?: IStoredNotifyOnReact,
    monitoringMessage?: IMonitoringMessage,

    idConfigTicket?: string,
    ticketConfig?: ITicketConfig,
    listening?: IMessageToListen

    welcomeMessage?: IWelcomeMessage,

    givenStartGradeIndex?: number
}