import {ITextInvite} from "../Models/Text/TextInvite";
import {ITextAskInviteBack} from "../Models/Text/TextAskInviteBack";
import {IVocalInvite} from "../Models/Vocal/VocalInvite";
import {IVocalAskInviteBack} from "../Models/Vocal/VocalAskInviteBack";
import {
    DMChannel,
    Guild,
    GuildChannel,
    GuildMember,
    Message, Snowflake,
    TextBasedChannel, ThreadChannel,
    User,
    VoiceChannel,
    VoiceState
} from "discord.js";

export interface IReportedErrorData {
    from?: 'guildCreate'|'initSlashCommands'|'messageCreate'|'customCommand'|'slashCommand'|'vocalInvite'|'textInvite'|'vocalInviteBack'|'textInviteBack'|'voiceConnect',
    guild?: Guild,
    message?: Message,
    user?: User|GuildMember,
    channel?: GuildChannel|VoiceChannel|ThreadChannel|DMChannel|TextBasedChannel,

    command?: string,
    commandId?: Snowflake,
    commandArguments?: {[key: string]: any},

    buttonData?: ITextInvite|ITextAskInviteBack|IVocalInvite|IVocalAskInviteBack,

    oldVoiceState?: VoiceState,
    newVoiceState?: VoiceState,
}

export default class CustomError extends Error {
    data: null|IReportedErrorData = null
    constructor(eOrMessage: string|Error|CustomError, data: null|IReportedErrorData = null) {
        super();
        if (eOrMessage instanceof CustomError || eOrMessage instanceof Error) {
            this.message = eOrMessage.message;
            this.name = eOrMessage.name;
            this.stack = eOrMessage.stack
        }

        this.data = (eOrMessage instanceof CustomError && eOrMessage.data !== null) ? {
            ...eOrMessage.data,
            ...(data??{})
        } : data;
    }
}