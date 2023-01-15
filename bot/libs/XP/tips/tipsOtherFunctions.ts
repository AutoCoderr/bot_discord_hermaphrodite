import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, GuildMember} from "discord.js";
import XPTipsUsefulAskButton, {IXPTipsUsefulAskButton} from "../../../Models/XP/XPTipsUsefulAskButton";
import XPData, {ILevelTip, IXPData, tipFieldsFixedLimits} from "../../../Models/XP/XPData";
import {getMP} from "../../../Classes/OtherFunctions";
import {approveOrUnApproveTip} from "./tipsManager";

export async function listenXPTipsUseFulApproveButtons(interaction: ButtonInteraction): Promise<boolean> {
    const button: null|IXPTipsUsefulAskButton = await XPTipsUsefulAskButton.findOne({
        userId: interaction.user.id,
        buttonId: interaction.customId
    });

    if (button === null)
        return false;

    const XPServerConfig: null|IXPData = await XPData.findOne({
        serverId: button.serverId
    });

    let updatedTips: ILevelTip[]|false;
    if (XPServerConfig !== null && (updatedTips = approveOrUnApproveTip(interaction.user, XPServerConfig.tipsByLevel, button.level, button.useful))) {
        XPServerConfig.tipsByLevel = updatedTips;
        await XPServerConfig.save();

        await interaction.editReply("Vous avez trouvé ce tip "+(button.useful ? "utile" : "inutile"));
    } else {
        await interaction.editReply("Ce tip semble ne plus exister");
    }

    await XPTipsUsefulAskButton.deleteMany({
        messageId: button.messageId
    });
    
    const message = await getMP(interaction.user, button.messageId);
    if (message === null)
        return true;

    await message.edit({
        content: message.content.split("\n-------------------------------")[0],
        components: []
    })

    return true;
}

export async function getTipMessage(member: GuildMember, level: number, tip: ILevelTip)
    : Promise<{
        content: string, 
        components?: [ActionRowBuilder], 
        tipAcceptButtonId: string|null,
        tipDenyButtonId: string|null
    }> {
    const tipAcceptButtonId = level > 1 ? (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "ta" : null;
    const tipDenyButtonId = level > 1 ? (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "td" : null;

    return {
        tipAcceptButtonId,
        tipDenyButtonId,
        content: ( level > 1 ?
            "\nVoici un nouveau tip sur le" :
            "\nVoici le premier tip du" )+" serveur "+member.guild.name
        +"\n\n"+tip.content+(level > 1 ? "\n-------------------------------\n\nAvez vous trouvé ce tip utile ?" : ""),
        components: level > 1 ? [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(<string>tipAcceptButtonId)
                    .setLabel("Oui")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(<string>tipDenyButtonId)
                    .setLabel("Non")
                    .setStyle(ButtonStyle.Danger),
            )
        ] : undefined
    }
}

export function checkTipsListData(tips: any) {
    return tips instanceof Array &&
        !tips.some((tip,index) => (
            typeof(tip) !== "object" ||
            tip === null ||
            tip instanceof Array ||

            typeof(tip.level) !== "number" ||
            tip.level%1 !== 0 ||
            tip.level < tipFieldsFixedLimits.level.min ||
            tip.level > tipFieldsFixedLimits.level.max ||
            (index > 0 && tip.level <= tips[index-1].level) ||

            typeof(tip.content) !== "string" ||
            tip.content.length < tipFieldsFixedLimits.content.min ||
            tip.content.length > tipFieldsFixedLimits.content.max ||

            Object.keys(tip).length > 2
        ))
}