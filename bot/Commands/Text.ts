import Command from "../Classes/Command";
import {CommandInteractionOptionResolver, Guild, GuildChannel, GuildMember, TextBasedChannels, User} from "discord.js";

interface argsType {
    action: 'add'|'remove'|'block'|'unblock'|'mute'|'unmute'|'limit'|'status',
    users?: GuildMember[],
    channels?: TextBasedChannels[],
    keyWords?: string[],
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

        console.log({ action, users, channels, keyWords, time });

        return this.response(false, "COUCOU");
    }
}
