import Command from "../Classes/Command";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildChannel,
    GuildMember,
    MessageEmbed,
    TextBasedChannels,
    User
} from "discord.js";
import TextConfig, {ITextConfig} from "../Models/Text/TextConfig";
import TextUserConfig, {ITextUserConfig} from "../Models/Text/TextUserConfig";
import TextSubscribe, {ITextSubscribe} from "../Models/Text/TextSubscribe";

interface argsType {
    action: 'add'|'remove'|'block'|'unblock'|'mute'|'unmute'|'limit'|'status',
    users: GuildMember[],
    channels: TextBasedChannels[],
    keyWords: string[],
    time?: number
}

export default class Text extends Command {
    static display = true;
    static description = "Pour recevoir des notifications lorsque les personnes abonnées parlent sur un channel textuel";
    static commandName = "text";

    static customCommand = false;
    static slashCommand = true;

    static argsModel = {
        $argsByType: {
            action: {
                isSubCommand: true,
                required: true,
                type: "string",
                description: "L'action à effectuer : add, remove, block, unblock, mute, unmute, limit, status",
                choices: {
                    add: "Envoyer une ou plusieurs demandes d'écoute ou redéfinir leurs mots clés",
                    remove: "Supprimer une ou plusieurs écoute en cours, ou supprimer des mots clés",
                    block: "Bloquer un/des utilisateurs et/ou un/des channels pour les empêcher de vous écouter",
                    unblock: "Débloquer un/des utilisateurs et/ou un/des channels",
                    mute: "Bloquer les notifications pendant un certain temps (exemple de temps: 30s, 5min, 3j) ou indéfiniment",
                    unmute: "Se démuter",
                    limit: "Avoir un répit entre chaque notification (exemple de temps: 30s, 5min, 3j)",
                    status: "Voir ses infos"
                }
            },
            users: {
                referToSubCommands: ['add','remove','block','unblock'],
                required: args => args.action === 'add',
                displayValidError: true,
                displayValidErrorEvenIfFound: true,
                displayExtractError: true,
                type: 'user',
                multi: true,
                description: "Le ou les users à écouter, ignorer ou bloquer",
                valid: (users: GuildMember | GuildMember[], args, command: Command) => {
                    if (users instanceof GuildMember && (users.id === command.member.id || args.users.some(eachUser => eachUser.id === users.id)))
                        return false;
                    if (users instanceof Array) {
                        let alreadySpecifieds = {};
                        for (const user of users) {
                            if (user.id === command.member.id || alreadySpecifieds[user.id])
                                return false;
                            else
                                alreadySpecifieds[user.id] = true;
                        }
                    }
                    return true;
                },
                errorMessage: () => ({
                    name: "Utilisateurs non ou mal renseigné",
                    value: "Vous n'avez pas ou mal renseigné les utilisateurs.\n" +
                        "Vous ne pouvez pas vous renseignez vous même, ni renseigner plusieurs fois les mêmes personnes"
                })
            },
            channels: {
                referToSubCommands: ['add','remove','block','unblock'],
                required: (args, _, modelize = false) => !modelize && ['block','unblock'].includes(args.action) && (args.users === undefined || args.users.length === 0),
                displayValidError: true,
                displayValidErrorEvenIfFound: true,
                displayExtractError: true,
                type: 'channel',
                multi: true,
                description: "Le ou les channels à écouter, ignorer ou bloquer",
                valid: (channels: GuildChannel | GuildChannel[], args) => {
                    if (channels instanceof GuildChannel && (channels.type !== 'GUILD_TEXT' || args.channels.some(eachChannel => eachChannel.id === channels.id)))
                        return false;
                    if (channels instanceof Array) {
                        let alreadySpecifieds = {};
                        for (const channel of channels) {
                            if (channel.type !== 'GUILD_TEXT' || alreadySpecifieds[channel.id])
                                return false;
                            else
                                alreadySpecifieds[channel.id] = true;
                        }
                    }
                    return true;
                },
                errorMessage: (value, args) => (['block','unblock'].includes(args.action) && value === undefined && (args.users === undefined || args.users.length === 0)) ?
                    {
                        name: "Rentrez au moins l'un des deux",
                        value: "Vous devez avoir mentionné au moins un utilisateur ou un channel"
                    } : {
                        name: "Channels non ou mal renseignés",
                        value: "Vous n'avez pas ou mal renseigné les channels.\n" +
                            "Vous ne pouvez renseigner que des channels textuels, et vous ne pouvez pas renseigner plusieurs fois le même channel"
                    }
            },
            keyWords: {
                referToSubCommands: ['add','remove'],
                required: (args, _, modelize = false) => !modelize && args.action === "remove" &&
                    (args.users === undefined || args.users.length === 0) &&
                    (args.channels === undefined || args.channels.length === 0),
                type: 'string',
                multi: true,
                description: "Le ou les mots clé à définir, retirer, ou ajoiter",
                errorMessage: () => ({
                    name: "Rentrez au moins l'un des trois",
                    value: "Vous devez avoir mentionné au moins un utilisateur, un channel ou un mot clé"
                })
            },
            time: {
                referToSubCommands: ['limit', 'mute'],
                required: (args) => args.action === 'limit',
                type: "duration",
                description: "Le temps durant lequel on souhaite ne pas recevoir de notif (ex: 30s, 5m, 3h, 2j)",
                valid: (time, args) => args.action === 'limit' || time > 0
            }
        }
    };

    constructor(channel: TextBasedChannels, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: string) {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, Text.commandName, Text.argsModel);
    }

    async action(args: argsType) {
        const { action, users, channels, keyWords, time } = args;

        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        const textConfig: ITextConfig = await TextConfig.findOne({serverId: this.guild.id, enabled: true});

        if (textConfig === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Vocal désactivé",
                    value: "Vous ne pouvez pas executer cette commande car l'option d'abonnement vocal n'est pas activée sur ce serveur"
                })
            );
        }

        if ((textConfig.listenerBlacklist.users.includes(this.member.id) ||
                textConfig.listenerBlacklist.roles.some(roleId => this.member instanceof GuildMember && this.member.roles.cache.some(role => role.id === roleId)))) {
            return this.response(false,
                this.sendErrors({
                    name: "Accès interdit",
                    value: "Vous n'avez visiblement pas le droit d'utiliser l'option d'abonnement textuel sur ce serveur"
                })
            );
        }

        const embed = new MessageEmbed()
            .setAuthor("Herma bot");

        if (action === "add") {
            const blockedChannelsByUserId: {[key: string]: string[]} = {};
            const usersBlockingMe: GuildMember[] = [];
            const hasNotText: GuildMember[] = [];
            for (const user of users) {
                if (!(await Text.staticCheckPermissions(null, user, this.guild, false)) ||
                    textConfig.listenerBlacklist.users.includes(user.id) ||
                    user.roles.cache.some(role => textConfig.listenerBlacklist.roles.includes(role.id))) {

                    hasNotText.push(user);
                    continue;
                }

                const userConfig: ITextUserConfig = await TextUserConfig.findOne({serverId: this.guild.id, userId: user.id});

                if (userConfig.blocking.some(({userId, channelId}) => userId === this.member.id && channelId === undefined)) {
                    usersBlockingMe.push(user);
                    continue;
                }

                if (channels.length === 0) {
                    blockedChannelsByUserId[user.id] = userConfig.blocking
                        .filter(({userId, channelId}) => (userId === this.member.id || userId === undefined) && channelId !== undefined)
                        .map(({channelId}) => <string>channelId);

                    const allChannelSubscribe: typeof TextSubscribe = await TextSubscribe.findOne({serverId: this.guild.id, listenerId: this.member.id, listenedId: user.id, channelId: {$exists: false}});
                    if (allChannelSubscribe) {
                        if (keyWords.length === 0)
                            allChannelSubscribe.keywords = undefined;
                        else
                            allChannelSubscribe.keywords = [...(allChannelSubscribe.keywords??[]), ...keyWords];
                        const specifiedChannelSubscribes: typeof TextSubscribe = await TextSubscribe.find({serverId: this.guild.id, listenerId: this.member.id, listenedId: user.id, channelId: {$exists: true}});
                        for (const subscribe of specifiedChannelSubscribes) {
                            if (Text.compareKeyWords(subscribe.keywords ,allChannelSubscribe.keywords))
                                subscribe.remove();
                        }

                        allChannelSubscribe.save();
                    }
                }
            }

            if (usersBlockingMe.length > 0)
                embed.addFields({
                    name: "Ces utilisateurs vous bloque : ",
                    value: usersBlockingMe.map(userId => "<@" + userId + ">").join("\n")
                });
            if (hasNotText.length > 0)
                embed.addFields({
                    name: "Ces utilisateurs n'ont pas la fonctionnalité de notification textuelle : ",
                    value: hasNotText.map(userId => "<@" + userId + ">").join("\n")
                });
            for (const [userId,blockedChannels] of Object.entries(blockedChannelsByUserId)) {
                embed.addFields({
                    name: "<@"+userId+"> vous a bloqué pour les channels suivants",
                    value: blockedChannels.map(channelId => "<#"+channelId+">").join("\n")
                });
            }

            return this.response(true, {embeds: [embed]});
        }

        return this.response(false, "COUCOU");
    }

    static compareKeyWords(A: string[]|undefined,B: string[]|undefined) {
        if ((A === undefined) !== (B === undefined))
            return false;
        if (A === undefined || B === undefined)
            return true;

        if (A.length !== B.length)
            return false;

        return !A.some(w => !B.includes(w));
    }
}
