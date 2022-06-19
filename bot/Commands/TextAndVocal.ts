import Command from "../Classes/Command";
import VocalAskInviteBack from "../Models/Vocal/VocalAskInviteBack";
import VocalInvite from "../Models/Vocal/VocalInvite";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildMember,
    TextChannel,
    User
} from "discord.js";
import VocalUserConfig from "../Models/Vocal/VocalUserConfig";
import VocalSubscribe from "../Models/Vocal/VocalSubscribe";
import TextInvite from "../Models/Text/TextInvite";
import TextAskInviteBack from "../Models/Text/TextAskInviteBack";
import TextUserConfig from "../Models/Text/TextUserConfig";
import TextSubscribe from "../Models/Text/TextSubscribe";

export default class TextAndVocal extends Command {
    static abstract = true;

    static models = {
        vocal: {
            userConfigModel: VocalUserConfig,
            subscribeModel: VocalSubscribe,
            inviteModel: VocalInvite,
            inviteBackModel: VocalAskInviteBack
        },
        text: {
            userConfigModel: TextUserConfig,
            subscribeModel: TextSubscribe,
            inviteModel: TextInvite,
            inviteBackModel: TextAskInviteBack
        }
    }

    type: 'text'|'vocal'|null = null;

    constructor(channel: TextChannel, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom', commandName: string, argsModel: any, type: 'vocal'|'text') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, commandName, argsModel);
        this.type = type;
    }


}
