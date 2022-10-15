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
    action: 'enable'|'disable'|'active_role'|'channel_role'|'presentation_message'|'first_message_time',
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
                    active_role: "Visionner ou configurer le rôle actif du système d'XP",
                    channel_role: "Visionner ou configurer le rôle d'accès aux channels du système d'XP",
                    enable: "Activer le système d'XP",
                    disable: "Désactiver le système d'XP",
                    presentation_message: "Visionner ou définir le message de bienvenue du système d'XP",
                    first_message_time: "Visionner ou définir l'heure minimale du premier message de la journée"
                }
            },
            setOrShowSubAction: {
                referToSubCommands: ['active_role','channel_role', 'presentation_message', 'first_message_time'],
                isSubCommand: true,
                required: true,
                type: "string",
                description: "Quelle type d'action effectuer ?",
                choices: {
                    set: "Définir",
                    show: "Visionner"
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

        return this["action"+args.action[0].toUpperCase()+args.action.substring(1)](args, XPServerConfig);
    }

    async actionEnable(args: IConfigXPArgs, XPServerConfig: IXPData) {
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

    async actionDisable(args: IConfigXPArgs, XPServerConfig: IXPData) {
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

    async actionFirst_message_time(args: IConfigXPArgs, XPServerConfig: IXPData) {
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

    async actionPresentation_message(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (args.setOrShowSubAction === "show")
            return this.response(true, XPServerConfig.presentationMessage ?
                "Voici le message de présentation du système d'XP : \n\n\n"+
                XPServerConfig.presentationMessage
            : "Vous n'avez configuré aucun message de présentation")


        return this.response(true, "Veuillez rentrer un message :", () => new Promise(resolve => {
            const listener = async (response: Message) => {
                if (response.author.id !== this.member.id)
                    return;

                XPServerConfig.presentationMessage = response.content

                await XPServerConfig.save();

                await response.delete();

                client.off('messageCreate', listener);

                resolve(this.response(true, "Message envoyé avec succès ! Vous pouvez le revisionner avec /configxp presentation_message show"))
            }
            client.on('messageCreate', listener);

            setTimeout(() => {
                client.off('messageCreate', listener);
                resolve(this.response(false, "Délai dépassé"));
            }, 10 * 60 * 1000)
        }))
    }

    async actionActive_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.defineAndShowRole(args, XPServerConfig, 'activeRoleId')
    }

    async actionChannel_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
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