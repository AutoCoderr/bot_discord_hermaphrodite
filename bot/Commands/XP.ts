import {CommandInteraction, EmbedBuilder, GuildMember, Message} from "discord.js";
import {IArgsModel} from "../interfaces/CommandInterfaces";
import AbstractXP from "./AbstractXP";
import {enableOrDisableUserNotification, findTipByLevel} from "../Classes/XPFunctions";
import {IXPData} from "../Models/XP/XPData";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";

interface IXPArgs {
    action: 'notif'|'infos'|'tips'|'approve'|'un_approve',
    notifSubActions: 'show'|'enable'|'disable',
    level: number;
}

export default class XP extends AbstractXP<IXPArgs> {
    static display = true;
    static abstract = false;
    static description = "Commandes pour la système d'XP"
    static commandName = "XP";

    static customCommand = false

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    getXPUserConfig(member: GuildMember, create: boolean = false): Promise<null|IXPUserData> {
        return XPUserData.findOne({
            serverId: member.guild.id,
            userId: member.id
        }).then(XPUserConfig =>
            (!create || XPUserConfig !== null) ?
                XPUserConfig :
                XPUserData.create({
                    serverId: member.guild.id,
                    userId: member.id,
                })
        )
    }

    static argsModel: IArgsModel<IXPArgs> = {
        $argsByType: {
            action: {
                isSubCommand: true,
                choices: {
                    notif: null,
                    infos: "Voir les informations (XP, rang, etc...)",
                    tips: "Voir les tips accessible, ou un tip donné",
                    approve: "Marquer un tip comme utile",
                    un_approve: "Marquer un tip comme inutile"
                },
                type: "string",
                description: "Les différentes actions"
            },
            notifSubActions: {
                isSubCommand: true,
                referToSubCommands: ['notif'],
                type: "string",
                description: "Les sous actions des notifications",
                choices: {
                    show: "Visionner l'état des notifications",
                    enable: "Activer les notifications",
                    disable: "Désactiver les notifications"
                }
            },
            level: {
                referToSubCommands: ['tips','approves','un_approve'],
                type: "overZeroInteger",
                evenCheckAndExtractForSlash: true,
                description: "Rentrer un niveau",
                required: args => args.action !== "tips",
                valid: async (value, _, command: XP) => {
                    const XPServerConfig = await command.getXPServerConfig();

                    return XPServerConfig === null || !XPServerConfig.enabled || findTipByLevel(value, XPServerConfig.tipsByLevel) !== null
                },
                errorMessage: value =>
                    value <= 0 ? {
                        name: "Donnée invalide",
                        value: "Le niveau doit être un entier naturel (> 0)"
                    } : {
                        name: "Tip introuvable",
                        value: "Aucun tip associé au niveau "+value+" n'a été trouvé"
                    }
            }
        }
    }

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, XP.commandName, XP.argsModel);
    }

    async action(args: IXPArgs, bot) {
        const XPServerConfig = await this.getXPServerConfig();

        if (XPServerConfig === null || !XPServerConfig.enabled)
            return this.response(false, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Système d'XP désactivé")
                        .setFields({
                            name: "Système d'XP désactivé",
                            value: "Le système d'XP est désactivé sur ce serveur"
                        })
                ]
            })

        return this['action_'+args.action](args,XPServerConfig);
    }

    async action_notif(args: IXPArgs, XPServerConfig: IXPData) {
        return this['action_notif_'+args.notifSubActions](args,XPServerConfig);
    }

    async action_notif_enable(args: IXPArgs, XPServerConfig: IXPData) {
        const XPUserConfig = await <Promise<IXPUserData>>this.getXPUserConfig(this.member, true);

        const success = await enableOrDisableUserNotification(this.member, XPUserConfig, true, XPServerConfig)

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle(success ? "Notification activées avec succès" : "Activation des notification échouée")
                    .setFields({
                        name: success ? "Notification activées avec succès" : "Activation des notification échouée",
                        value: success ? "Notification activées avec succès" : "Êtes vous sur d'avoir autorisé les messages privés?"
                    })
            ]
        })
    }

    async action_notif_disable() {
        const XPUserConfig = await <Promise<IXPUserData>>this.getXPUserConfig(this.member, true);

        await enableOrDisableUserNotification(this.member, XPUserConfig, false)

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Notification activées avec succès")
                    .setFields({
                        name: "Notification activées avec succès",
                        value: "Notification activées avec succès"
                    })
            ]
        })
    }

    async action_notif_show(args: IXPArgs) {
        const XPUserConfig = await this.getXPUserConfig(this.member);
        const active = XPUserConfig !== null && XPUserConfig.DMEnabled;
        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Notifications "+(active ? "activées" : "désactivées"))
                    .setFields({
                        name: "Notifications "+(active ? "activées" : "désactivées"),
                        value: "Les notifications sont "+(active ? "activées" : "désactivées")
                    })
            ]
        })
    }
}