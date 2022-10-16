import Command from "../Classes/Command";
import { IArgsModel} from "../interfaces/CommandInterfaces";
import {
    bold,
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
import client from "../client";
import {extractUTCTime, showTime} from "../Classes/DateTimeManager";

interface IConfigXPArgs {
    action: 'enable'|'disable'|'active_role'|'channel_role'|'presentation_message'|'first_message_time'|'show_xp_gain',
    setOrShowSubAction: 'set'|'show',
    role: Role,
    duration: number
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
                required: true,
                type: "string",
                description: "Ce que vous souhaitez configurer",
                choices: {
                    enable: "Activer le système d'XP",
                    disable: "Désactiver le système d'XP",
                    show_xp_gain: "Afficher les gains d'XP par type",
                    active_role: "le rôle actif du système d'XP",
                    channel_role: "le rôle d'accès aux channels du système d'XP",
                    presentation_message: "le message de bienvenue du système d'XP",
                    first_message_time: "l'heure minimale du premier message de la journée",
                }
            },
            setOrShowSubAction: {
                referToSubCommands: ['active_role','channel_role', 'presentation_message', 'first_message_time'],
                isSubCommand: true,
                required: true,
                type: "string",
                description: "Quelle type d'action effectuer ?",
                choices: {
                    set: (_, parentDescription) => "Définir "+parentDescription,
                    show: (_, parentDescription) => "Visionner "+parentDescription
                }
            },
            role: {
                referToSubCommands: ['active_role.set', 'channel_role.set'],
                type: "role",
                required: args =>
                    ["active_role","channel_role"].includes(args.action) && args.setOrShowSubAction === "set",
                description: "Quel rôle définir"
            },
            duration: {
                referToSubCommands: ['first_message_time.set'],
                type: "duration",
                required: args =>
                    args.action == "first_message_time" && args.setOrShowSubAction === "set",
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

    async action_show_xp_gain(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Gains d'xp par type :")
                    .setFields(
                        {
                            name: "Gain d'XP par message toutes les "+showTime(extractUTCTime(XPServerConfig.timeLimitMessage), 'fr'),
                            value: XPServerConfig.XPByMessage+" XP"
                        },
                        {
                            name: "Gain d'XP toutes les "+showTime(extractUTCTime(XPServerConfig.timeLimitVocal), 'fr')+" en vocal",
                            value: XPServerConfig.XPByVocal+" XP"
                        },
                        {
                            name: "Combien d'XP par bump",
                            value: XPServerConfig.XPByBump+" XP"
                        },
                        {
                            name: "Combien d'XP pour le premier message du jour",
                            value: XPServerConfig.XPByFirstMessage+" XP"
                        }
                    )
            ]
        })
    }

    async action_presentation_message(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (args.setOrShowSubAction === "show")
            return this.response(true, XPServerConfig.presentationMessage ?
                "Voici le message de présentation du système d'XP : \n\n\n"+
                XPServerConfig.presentationMessage
            : "Vous n'avez configuré aucun message de présentation")


        return this.response(true, "Veuillez rentrer un message :", () => new Promise(resolve => {
            let timeout;
            const listener = async (response: Message) => {
                if (response.author.id !== this.member.id)
                    return;

                XPServerConfig.presentationMessage = response.content

                clearTimeout(timeout);

                await XPServerConfig.save();

                await response.delete();

                client.off('messageCreate', listener);

                resolve(this.response(true, "Message envoyé avec succès ! Vous pouvez le revisionner avec /configxp presentation_message show"))
            }
            client.on('messageCreate', listener);

            timeout = setTimeout(() => {
                client.off('messageCreate', listener);
                resolve(this.response(false, "Délai dépassé"));
            }, 10 * 60 * 1000)
        }))
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