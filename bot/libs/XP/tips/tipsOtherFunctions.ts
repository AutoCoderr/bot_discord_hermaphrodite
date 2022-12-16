import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, GuildMember} from "discord.js";
import XPTipsUsefulAskButton, {IXPTipsUsefulAskButton} from "../../../Models/XP/XPTipsUsefulAskButton";
import XPData, {ILevelTip, IXPData} from "../../../Models/XP/XPData";
import {deleteMP} from "../../../Classes/OtherFunctions";
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

    await deleteMP(interaction.user, button.messageId);
    await XPTipsUsefulAskButton.deleteMany({
        messageId: button.messageId
    });

    return true;
}

export async function sendTip(member: GuildMember, level: number, tip: ILevelTip) {
    const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "ta";
    const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "td";

    await member.send((
            level === 1 ?
                "Vous venez de débloquer le premier niveau du système d'XP de '"+member.guild.name+"' !" :
                "Vous avez atteint le niveau "+level+" du système d'XP de '"+member.guild.name+"'!") +
        ( level > 1 ?
            "\nVoici un nouveau tip :" :
            "" )
        +"\n\n"+tip.content)

    if (level === 1)
        return;

    const message = await member.send({
        content: "\n-------------------------------\n\nAvez vous trouvé ce tip utile ?",
        components: [ //@ts-ignore
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(acceptButtonId)
                    .setLabel("Oui")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(denyButtonId)
                    .setLabel("Non")
                    .setStyle(ButtonStyle.Danger),
            )
        ]
    })

    await Promise.all(
        [
            [acceptButtonId, true],
            [denyButtonId, false]
        ].map(([buttonId, useful]) =>
            XPTipsUsefulAskButton.create({
                serverId: member.guild.id,
                userId: member.id,
                useful,
                level,
                buttonId,
                messageId: message.id
            })
        )
    )
}

export function checkTipsListData(tips: any) {
    return tips instanceof Array &&
        !tips.some((tip,index) => (
            typeof(tip) !== "object" ||
            tip === null ||
            tip instanceof Array ||

            typeof(tip.level) !== "number" ||
            tip.level%1 !== 0 ||
            tip.level <= 0 ||
            (index > 0 && tip.level <= tips[index-1].level) ||

            typeof(tip.content) !== "string" ||

            Object.keys(tip).length > 2
        ))
}