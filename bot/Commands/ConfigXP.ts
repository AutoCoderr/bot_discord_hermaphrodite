import Command from "../Classes/Command";
import { IArgsModel} from "../interfaces/CommandInterfaces";
import {CommandInteractionOptionResolver, EmbedBuilder, Guild, GuildMember, Role, TextChannel, User} from "discord.js";
import XPData, {IXPData} from "../Models/XP/XPData";

interface IConfigXPArgs {
    action: 'active_role',
    setOrShowSubAction: 'set'|'show',
    role: Role
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
                    enable: "Activer le système d'XP",
                    disable: "Désactiver le système d'XP"
                }
            },
            setOrShowSubAction: {
                referToSubCommands: ['active_role'],
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
                referToSubCommands: ['active_role.set'],
                type: "role",
                required: (args, command, modelizeSlashCommand = false) =>
                    modelizeSlashCommand || (args.action === "active_role" && args.setOrShowSubAction === "set"),
                description: "Quel rôle définir"
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

        return this[args.action](args, XPServerConfig);
    }

    async enable(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (XPServerConfig.activeRoleId === undefined)
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Activer système d'XP")
                        .setFields({
                            name: "Activer système d'XP",
                            value: "Vous devez d'abord définir le rôle actif via la commande /configxp activerole set"
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

    async disable(args: IConfigXPArgs, XPServerConfig: IXPData) {
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

    async active_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (args.setOrShowSubAction === "show")
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Rôle actif")
                        .setFields({
                            name: "Rôle actif :",
                            value: XPServerConfig.activeRoleId ?
                                "<@&"+XPServerConfig.activeRoleId+">" :
                                "Non défini"
                        })
                ]
            })
        XPServerConfig.activeRoleId = args.role.id;
        await XPServerConfig.save()

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Définir le rôle actif")
                    .setFields({
                        name: "Rôle définit avec succès !",
                        value: "Rôle définit avec succès !"
                    })
            ]
        })
    }
}