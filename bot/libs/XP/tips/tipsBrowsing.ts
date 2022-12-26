import XPData, {ILevelTip, IXPData} from "../../../Models/XP/XPData";
import XPUserData, {IXPUserData} from "../../../Models/XP/XPUserData";
import {responseResultType} from "../../../interfaces/CommandInterfaces";
import {
    ActionRowBuilder,
    ButtonBuilder, ButtonInteraction,
    ButtonStyle,
    CommandInteraction,
    EmbedBuilder, Guild, GuildMember,
    InteractionReplyOptions
} from "discord.js";
import ConfigXP from "../../../Commands/ConfigXP";
import {round} from "../../../Classes/OtherFunctions";
import {findTipByLevel} from "./tipsManager";

export interface IArrowTipButton {
    id: string;
    level: number;
    otherButtonId?: string;
    type: 'prev'|'next';
    isAdmin: boolean;
    interaction: CommandInteraction;
    timestamps: Date;
}

export const arrowsTipsButtons: {[id: string]: IArrowTipButton} = {}

export function cleanTipButtons() {
    const date = new Date();
    for (const [id, {timestamps}] of Object.entries(arrowsTipsButtons)) {
        if (date.getTime() - timestamps.getTime() > 5 * 60 * 1000)
            delete arrowsTipsButtons[id];
    }
}

export async function listenXPArrowsTipsButtons(interaction: ButtonInteraction): Promise<boolean> {
    if (arrowsTipsButtons[interaction.customId] === undefined || !(interaction.guild instanceof Guild) || !(interaction.member instanceof GuildMember))
        return false;

    const button = arrowsTipsButtons[interaction.customId];
    if (button.otherButtonId)
        delete arrowsTipsButtons[button.otherButtonId];
    delete arrowsTipsButtons[interaction.customId];

    const XPServerConfig: null|IXPData = await XPData.findOne({
        serverId: interaction.guild.id,
        enabled: true
    });

    await interaction.deleteReply();

    if (XPServerConfig === null ||
        (
            !button.isAdmin &&
            !interaction.member.roles.cache.some(role => role.id === XPServerConfig.activeRoleId)
        )
    ) {
        await button.interaction.editReply({
            content: "Le système d'XP est soit inactif ou inaccessible",
            components: [],
            embeds: []
        });
        return true;
    }

    const XPUserConfig: null|IXPUserData = !button.isAdmin ? await XPUserData.findOne({
        serverId: interaction.guild.id,
        userId: interaction.user.id
    }) : null

    if (!button.isAdmin && (XPUserConfig === null || button.level > XPUserConfig.currentLevel)) {
        await button.interaction.editReply({
            content: "Vous n'avez pas accès à ce tip",
            components: [],
            embeds: []
        });
        return true;
    }

    const tip: null|ILevelTip = findTipByLevel(button.level, XPServerConfig.tipsByLevel);

    if (tip === null) {
        await button.interaction.editReply({
            content: "Le tip " + button.level + " n'existe pas",
            components: [],
            embeds: []
        });
        return true;
    }

    await button.interaction.editReply(showTip(XPServerConfig.tipsByLevel, tip, button.interaction, XPUserConfig));

    return true;
}

export function showTipsList(tips: ILevelTip[], XPUserConfig: null|IXPUserData = null): responseResultType {
    const filteredTips = XPUserConfig !== null ?
        tips.filter(tip => tip.level <= XPUserConfig.currentLevel) :
        tips;

    return {
        embeds: [
            filteredTips.length > 0 ?
                new EmbedBuilder()
                    .setTitle(XPUserConfig === null ? filteredTips.length + " tip(s) sont défini(s)" : "Voici les tips qui vous sont accessibles")
                    .setFields(filteredTips.map(tip => ({
                        name: "Palier " + tip.level,
                        value: tip.content.substring(0, Math.min(10, tip.content.length)).replace(/\n/, "[br]") + (tip.content.length > 10 ? "..." : [])
                    }))) :
                new EmbedBuilder()
                    .setTitle("Aucun tips")
                    .setFields({
                        name: "Aucun tips",
                        value: "Aucun tips n'a été trouvé" + (
                            XPUserConfig === null ?
                                ", vous pouvez en définir un avec '/" + ConfigXP.commandName + " tips set <level>'." : "."
                        )
                    })
        ]
    }
}

export function showTip(allTips: ILevelTip[], tip: ILevelTip, interaction: CommandInteraction, XPUserConfig: null|IXPUserData = null): InteractionReplyOptions {
    const embed = new EmbedBuilder()
        .setTitle("Tip numéro "+tip.level)
        .setFields({
            name: "Voici le tip "+tip.level,
            value: tip.content
        });

    if (tip.userApproves !== null && tip.userUnapproves !== null) {
        if (XPUserConfig !== null) {
            const [approved, unApproved] = [
                tip.userApproves.some(id => id === XPUserConfig.userId),
                tip.userUnapproves.some(id => id === XPUserConfig.userId)
            ]
            embed.addFields({
                name: "Votre avis",
                value: (approved || unApproved) ?
                    "Vous l'avez trouvé "+(approved ? "utile" : "inutile") :
                    "Vous n'avez donné aucun avis"
            })
        } else {
            embed.addFields(
                {
                    name: "Utilisateurs ayant trouvés ce tip utile :",
                    value: tip.userApproves.length > 0 ?
                        tip.userApproves.length+" ("+round(tip.userApproves.length / (tip.userApproves.length+tip.userUnapproves.length) * 100, 2)+"%)" :
                        "0 (0%)"
                },
                {
                    name: "Utilisateurs ayant trouvés ce tip inutile :",
                    value: tip.userUnapproves.length ?
                        tip.userUnapproves.length+" ("+round(tip.userUnapproves.length / (tip.userApproves.length+tip.userUnapproves.length) * 100, 2)+"%)" :
                        "0 (0%)"
                })
        }
    }

    cleanTipButtons();

    const nextTip: undefined|ILevelTip = allTips.find(ATip =>  ATip.level > tip.level && (XPUserConfig === null || ATip.level <= XPUserConfig.currentLevel));

    const nextButton: null|IArrowTipButton = nextTip !== undefined ? {
        id: (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "nt",
        level: nextTip.level,
        interaction,
        type: 'next',
        isAdmin: XPUserConfig === null,
        timestamps: new Date()
    } : null

    const prevTip: undefined|ILevelTip = allTips.reverse().find(ATip => ATip.level < tip.level);

    const prevButton: null|IArrowTipButton = prevTip !== undefined ? {
        id: (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "pt",
        level: prevTip.level,
        interaction,
        type: 'prev',
        isAdmin: XPUserConfig === null,
        otherButtonId: nextButton ? nextButton.id : undefined,
        timestamps: new Date()
    } : null

    if (nextButton && prevButton)
        nextButton.otherButtonId = prevButton.id

    if (prevButton)
        arrowsTipsButtons[prevButton.id] = prevButton;
    if (nextButton)
        arrowsTipsButtons[nextButton.id] = nextButton;

    //@ts-ignore
    return {
        embeds: [
            embed
        ],
        ...(
            (prevButton || nextButton) ? {
                components: [
                    new ActionRowBuilder().addComponents(
                        (<IArrowTipButton[]>[prevButton,nextButton]
                            .filter(b => b !== null))
                            .map((b) =>
                                new ButtonBuilder()
                                    .setCustomId(b.id)
                                    .setLabel(
                                        (
                                            b.type === "prev" ?
                                                b.level === 1 ?
                                                    "Premier" :
                                                    "Précédent" :
                                                "Suivant"
                                        )+" ("+b.level+")"
                                    )
                                    .setStyle(ButtonStyle.Primary),
                            )
                    )
                ]
            } : {}
        )
    }
}