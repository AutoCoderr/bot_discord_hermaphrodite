import Command from "../Classes/Command";
import {IArgsModel} from "../interfaces/CommandInterfaces";
import {
    CommandInteractionOptionResolver,
    EmbedBuilder,
    Guild,
    GuildMember,
    Message,
    Role,
    TextChannel,
    User
} from "discord.js";
import XPData, {IXPData} from "../Models/XP/XPData";
import {extractUTCTime, showTime} from "../Classes/DateTimeManager";
import {findTipByLevel, setTipByLevel} from "../Classes/OtherFunctions";
import client from "../client";

interface IConfigXPArgs {
    action:
        'enable'|
        'disable'|
        'active_role'|
        'channel_role'|
        'first_message_time'|
        'xp_gain_show'|
        'xp_gain_set'|
        'limit_gain_set'|
        'tips',
    setOrShowSubAction: 'set'|'show',
    XPActionTypes: 'vocal'|'message'|'first_message'|'bump',
    XPActionTypesToLimit: 'vocal'|'message',
    tipsSubActions: 'list'|'show'|'set'|'delete'
    role: Role,
    duration: number,
    XP: number,
    level: number
}

export default class ConfigXP extends Command<IConfigXPArgs> {
    static display = true;
    static description = "Configurer le système d'XP"
    static commandName = "configXP";

    static customCommand = false

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel<IConfigXPArgs> = {
        $argsByType: {
            action: {
                isSubCommand: true,
                type: "string",
                description: "Ce que vous souhaitez configurer",
                choices: {
                    enable: "Activer le système d'XP",
                    disable: "Désactiver le système d'XP",
                    active_role: "le rôle actif du système d'XP",
                    channel_role: "le rôle d'accès aux channels du système d'XP",
                    first_message_time: "l'heure minimale du premier message de la journée",
                    xp_gain_show: "Afficher les gains d'XP par type",
                    xp_gain_set: "Définir le taux d'XP",
                    limit_gain_set: "Définir la limite de gain d'XP",
                    tips: null
                }
            },
            setOrShowSubAction: {
                referToSubCommands: ['active_role','channel_role', 'first_message_time'],
                isSubCommand: true,
                type: "string",
                description: "Quelle type d'action effectuer ?",
                choices: {
                    set: (_, parentDescription) => "Définir "+parentDescription,
                    show: (_, parentDescription) => "Visionner "+parentDescription
                }
            },
            XPActionTypes: {
                referToSubCommands: ['xp_gain_set'],
                isSubCommand: true,
                type: "string",
                description: "Quel type de gain d'XP ?",
                choices: {
                    message: (_, parentDescription) => parentDescription+" par message",
                    vocal: (_, parentDescription) => parentDescription+" pour le vocal",
                    first_message: (_, parentDescription) => parentDescription+" pour le premier message de la journée",
                    bump: (_, parentDescription) => parentDescription+" par bump"
                }
            },
            XPActionTypesToLimit: {
                referToSubCommands: ['limit_gain_set'],
                isSubCommand: true,
                type: "string",
                description: "Quel type de gain d'XP ?",
                choices: {
                    message: (_, parentDescription) => parentDescription+" par message",
                    vocal: (_, parentDescription) => parentDescription+" pour le vocal",
                }
            },
            tipsSubActions: {
                referToSubCommands: ['tips'],
                isSubCommand: true,
                type: "string",
                description: "Quel type d'action sur les tips?",
                choices: {
                    show: "Afficher un tips",
                    set: "Définir un tips",
                    delete: "Supprimer un tips",
                    list: "Lister les tips"
                }
            },
            level: {
                referToSubCommands: ['tips.show', 'tips.delete', 'tips.set'],
                type: "overZeroInteger",
                evenCheckForSlash: true,
                description: "Rentrez une valeur",
                errorMessage: () => ({
                    name: "Donnée invalide",
                    value: "Le niveau doit être un entier naturel (> 0)"
                })
            },
            XP: {
                referToSubCommands: ['message', 'vocal', 'first_message', 'bump'].map(t => 'xp_gain_set.'+t),
                type: "overZeroInteger",
                evenCheckForSlash: true,
                description: "Rentrez une valeur",
                errorMessage: () => ({
                    name: "Donnée invalide",
                    value: "Le nombre d'XP doit être un entier naturel (> 0)"
                })
            },
            role: {
                referToSubCommands: ['active_role.set', 'channel_role.set'],
                type: "role",
                description: "Quel rôle définir"
            },
            duration: {
                referToSubCommands: ['first_message_time.set','limit_gain_set.message','limit_gain_set.vocal'],
                type: "duration",
                description: "Donnez une durée (ex: 7h, 6h30, etc...)"
            }
        }
    }

    constructor(channel: TextChannel, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, ConfigXP.commandName, ConfigXP.argsModel);
    }

    async action(args: IConfigXPArgs, bot) {

        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        const XPServerConfig: IXPData = await XPData.findOne({
            serverId: this.guild.id
        }).then(XPServerConfig => XPServerConfig ?? XPData.create({
            serverId: (<Guild>this.guild).id
        }));

        return this["action_"+args.action](args, XPServerConfig);
    }

    async action_enable(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (XPServerConfig.activeRoleId === undefined)
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Activer système d'XP")
                        .setFields({
                            name: "Activer système d'XP",
                            value: "Vous devez d'abord définir le rôle actif via la commande /configxp active_role set"
                        })
                ]
            })

        XPServerConfig.enabled = true;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Activer système d'XP")
                    .setFields({
                        name: "Activer système d'XP",
                        value: "Fonctionnalité activée avec succès !"
                    })
            ]
        })
    }

    async action_disable(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.enabled = false;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Désactiver système d'XP")
                    .setFields({
                        name: "Désactiver système d'XP",
                        value: "Fonctionnalité désactivée avec succès !"
                    })
            ]
        })
    }

    async action_tips(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this["action_tips_"+args.tipsSubActions](args, XPServerConfig)
    }

    async action_tips_set(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.response(true, "Veuillez rentrer un message pour le tip (tapez 'CANCEL' pour annuler) :",
            () => new Promise(resolve => {
                let timeout;
                const listener = async (response: Message) => {
                    if (response.author.id !== this.member.id)
                        return;

                    client.off('messageCreate', listener);
                    clearTimeout(timeout);

                    if (response.content === "CANCEL") {
                        await response.delete();
                        resolve(this.response(true, "Commande annulée"))
                        return;
                    }

                    XPServerConfig.tipsByLevel = setTipByLevel(args.level, response.content, XPServerConfig.tipsByLevel);
                    await XPServerConfig.save();

                    await response.delete();

                    resolve(
                        this.response(true, "Tips enregistré avec succès !")
                    )
                }

                client.on('messageCreate', listener);

                timeout = setTimeout(() => {
                    client.off('messageCreate', listener);
                    resolve(this.response(false, "Délai dépassé"));
                }, 15 * 60 * 1000)
            }))
    }

    async action_tips_delete(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const updatedTips = XPServerConfig.tipsByLevel.filter(tip => tip.level !== args.level);
        if (updatedTips.length === XPServerConfig.tipsByLevel.length)
            return this.response(false, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Element introuvable")
                        .setFields({
                            name: "Element introuvable",
                            value: "Aucun tip n'est défini pour le niveau "+args.level
                        })
                ]
            })

        XPServerConfig.tipsByLevel = updatedTips;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Element supprimé avec succès")
                    .setFields({
                        name: "Element supprimé avec succès",
                        value: "Le tip associé au niveau "+args.level+" a été supprimé avec succès !"
                    })
            ]
        })
    }

    async action_tips_show(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const tip = findTipByLevel(args.level, XPServerConfig.tipsByLevel);

        if (tip === null)
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Element introuvable")
                        .setFields({
                            name: "Element introuvable",
                            value: "Aucun tip n'est défini pour le niveau "+args.level
                        })
                ]
            })

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Tip numéro "+args.level)
                    .setFields({
                        name: "Voici le tip "+args.level,
                        value: tip.content
                    })
            ]
        })
    }

    async action_tips_list(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.response(true, {
            embeds: [
                XPServerConfig.tipsByLevel.length > 0 ?
                    new EmbedBuilder()
                        .setTitle(XPServerConfig.tipsByLevel.length+" tip(s) sont défini(s)")
                        .setFields(XPServerConfig.tipsByLevel.map(tip => ({
                            name: "Niveau "+tip.level,
                            value: tip.content.substring(0, Math.min(10, tip.content.length)).replace(/\n/, "[br]")+(tip.content.length > 10 ? "..." : [])
                        }))) :
                    new EmbedBuilder()
                        .setTitle("Aucun tips")
                        .setFields({
                            name: "Aucun tips",
                            value: "Aucun tips n'a été trouvé, vous pouvez en définir un avec '/"+this.commandName+" tips set <level>'"
                        })
            ]
        })
    }

    async action_first_message_time(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (args.setOrShowSubAction === "show")
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Heure minimale du premier message")
                        .setFields({
                            name: "Heure configurée :",
                            value: showTime(extractUTCTime(XPServerConfig.firstMessageTime), 'fr')
                        })
                ]
            })

        XPServerConfig.firstMessageTime = args.duration;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Heure minimale du premier message")
                    .setFields({
                        name: "Vous avez configuré avec succès l'heure suivante :",
                        value: showTime(extractUTCTime(args.duration), 'fr')
                    })
            ]
        })
    }

    async action_xp_gain_show(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Gains d'xp par type :")
                    .setFields(
                        {
                            name: "Pour les messages",
                            value: "Gain de "+XPServerConfig.XPByMessage+"XP par message toutes les "+showTime(extractUTCTime(XPServerConfig.timeLimitMessage), 'fr')
                        },
                        {
                            name: "Pour le vocal",
                            value: "Gain de "+XPServerConfig.XPByVocal+" XP toutes les "+showTime(extractUTCTime(XPServerConfig.timeLimitVocal), 'fr')+" en vocal"
                        },
                        {
                            name: "Pour le premier message de la journée",
                            value: XPServerConfig.XPByFirstMessage+" XP"
                        },
                        {
                            name: "Pour chaque bump",
                            value: XPServerConfig.XPByBump+" XP"
                        }
                    )
            ]
        })
    }

    async action_limit_gain_set(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const col = {
            message: 'timeLimitMessage',
            vocal: 'timeLimitVocal'
        }[args.XPActionTypesToLimit]

        XPServerConfig[col] = args.duration;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Définir la limite de gain d'XP "+{
                        message: "par message",
                        vocal: "pour le vocal",
                    }[args.XPActionTypesToLimit])
                    .setFields({
                        name: "Vous avez défini la valeur suivante :",
                        value: showTime(extractUTCTime(args.duration), 'fr')
                    })
            ]
        })
    }

    async action_xp_gain_set(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const col = {
            message: 'XPByMessage',
            vocal: 'XPByVocal',
            first_message: 'XPByFirstMessage',
            bump: 'XPByBump'
        }[args.XPActionTypes];

        XPServerConfig[col] = args.XP
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Définir le gain d'XP "+{
                        message: "par message",
                        vocal: "pour le vocal",
                        first_message: "pour le premier message de la journée",
                        bump: "par bump"
                    }[args.XPActionTypes])
                    .setFields({
                        name: "Vous avez défini la valeur suivante :",
                        value: args.XP+" XP"
                    })
            ]
        })
    }

    async action_active_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.defineAndShowRole(args, XPServerConfig, 'activeRoleId')
    }

    async action_channel_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.defineAndShowRole(args, XPServerConfig, 'channelRoleId')
    }

    async defineAndShowRole(args: IConfigXPArgs, XPServerConfig: IXPData, col: 'activeRoleId'|'channelRoleId') {
        const typeName = col === "activeRoleId" ? "actif" : "d'accès";
        if (args.setOrShowSubAction === "show")
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Rôle "+typeName)
                        .setFields({
                            name: "Rôle "+typeName+" :",
                            value: XPServerConfig[col] ?
                                "<@&"+XPServerConfig[col]+">" :
                                "Non défini"
                        })
                ]
            })
        XPServerConfig[col] = args.role.id;
        await XPServerConfig.save()

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Définir le rôle "+typeName)
                    .setFields({
                        name: "Rôle défini avec succès !",
                        value: "Rôle défini avec succès !"
                    })
            ]
        })
    }
}