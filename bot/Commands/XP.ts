import {CommandInteraction, EmbedBuilder, Guild, Message} from "discord.js";
import {IArgsModel} from "../interfaces/CommandInterfaces";
import AbstractXP from "./AbstractXP";
import {embedTip, embedTipsList, enableOrDisableUserNotification, findTipByLevel} from "../Classes/XPFunctions";
import {ILevelTip, IXPData} from "../Models/XP/XPData";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";

interface IXPArgs {
    action: 'notif'|'infos'|'tips'|'approve'|'un_approve',
    notifSubActions: 'show'|'enable'|'disable',
    level?: number;
}

export default class XP extends AbstractXP<IXPArgs> {
    static display = true;
    static abstract = false;
    static description = "Commandes pour la système d'XP"
    static commandName = "XP";

    static customCommand = false

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    XPUserConfig: IXPUserData|null = null;

    async getXPUserConfig(): Promise<null|IXPUserData> {
        if (this.XPUserConfig === null)
            this.XPUserConfig = await XPUserData.findOne({
                serverId: (<Guild>this.guild).id,
                userId: this.member.id
            })

        return this.XPUserConfig;
    }

    static argsModel: IArgsModel<IXPArgs> = {
        $argsByType: {
            action: {
                isSubCommand: true,
                choices: {
                    notif: null,
                    infos: "Voir les informations (XP, rang, etc...)",
                    tips: "Voir les tips accessibles, ou un tip donné",
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
                    const XPUserConfig = await command.getXPUserConfig();

                    let tip: null|ILevelTip;

                    return (
                        XPServerConfig === null ||
                        !XPServerConfig.enabled ||
                        !command.member.roles.cache.some(role => role.id === XPServerConfig.activeRoleId) ||
                        (
                            XPUserConfig !== null &&
                            (tip = findTipByLevel(value, XPServerConfig.tipsByLevel)) !== null &&
                            tip.level <= XPUserConfig.currentLevel
                        )
                    )
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

        if (XPServerConfig === null || !XPServerConfig.enabled || !this.member.roles.cache.some(role => role.id === XPServerConfig.activeRoleId))
            return this.response(false, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Système d'XP désactivé ou inaccessible")
                        .setFields({
                            name: "Système d'XP désactivé ou inaccessible",
                            value: "Le système d'XP est désactivé sur ce serveur ou vous est inaccessible"
                        })
                ]
            })

        const XPUserConfig = await this.getXPUserConfig().then(XPUserConfig =>
            XPUserConfig ?? XPUserData.create({
                serverId: (<Guild>this.guild).id,
                userId: this.member.id
            })
        )

        return this['action_'+args.action](args,XPServerConfig,XPUserConfig);
    }

    async action_tips(args: IXPArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        if (args.level === undefined)
            return this.response(true, {
                embeds: [
                    embedTipsList(XPServerConfig.tipsByLevel, XPUserConfig)
                ]
            })

        const tip = <ILevelTip>findTipByLevel(args.level, XPServerConfig.tipsByLevel);

        const [approved, unApproved] = [
            tip.userApproves.some(id => id === this.member.id),
            tip.userUnapproves.some(id => id === this.member.id)
        ]

        return this.response(true, {
            embeds: [
                embedTip(tip)
                    .addFields({
                        name: "Votre avis",
                        value: (approved || unApproved) ?
                            "Vous l'avez trouvé "+(approved ? "utile" : "inutile") :
                            "Vous n'avez donné aucun avis"
                    })
            ]
        })
    }

    async action_notif(args: IXPArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        return this['action_notif_'+args.notifSubActions](args,XPServerConfig, XPUserConfig);
    }

    async action_notif_enable(args: IXPArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        const success = await enableOrDisableUserNotification(this.member, XPUserConfig, true, XPServerConfig);

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle(success ? "Notification activées avec succès" : "Activation des notifications échouée")
                    .setFields({
                        name: success ? "Notification activées avec succès" : "Activation des notifications échouée",
                        value: success ? "Notification activées avec succès" : "Êtes vous sur d'avoir autorisé les messages privés?"
                    })
            ]
        })
    }

    async action_notif_disable(_, __, XPUserConfig: IXPUserData) {
        await enableOrDisableUserNotification(this.member, XPUserConfig, false)

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Notification désactivées avec succès")
                    .setFields({
                        name: "Notification désactivées avec succès",
                        value: "Notification désactivées avec succès"
                    })
            ]
        })
    }

    async action_notif_show(_, __, XPUserConfig: IXPUserData) {
        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Notifications "+(XPUserConfig.DMEnabled ? "activées" : "désactivées"))
                    .setFields({
                        name: "Notifications "+(XPUserConfig.DMEnabled ? "activées" : "désactivées"),
                        value: "Les notifications sont "+(XPUserConfig.DMEnabled ? "activées" : "désactivées")
                    })
            ]
        })
    }
}