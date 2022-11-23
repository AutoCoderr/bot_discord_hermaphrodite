import { Guild, GuildMember } from "discord.js";
import { deleteMP } from "../../Classes/OtherFunctions";
import client from "../../client";
import { askForNotifications } from "../../libs/XP/XPCounting/countingOtherFunctions";
import XPData from "../../Models/XP/XPData";
import XPNotificationAskButton, { IXPNotificationAskButton, XPNotificationAskButtonTimeout } from "../../Models/XP/XPNotificationAskButton"
import XPTipsUsefulAskButton, { IXPTipsUsefulAskButton, XPTipsUsefulAskButtonTimeout } from "../../Models/XP/XPTipsUsefulAskButton";

const enabledServersById: {[id: string]: boolean} = {};
const guildsById: {[id: string]: null|Guild} = {};
const membersById: {[id: string]: null|GuildMember} = {};

async function serverHasXPsEnabled(serverId: string) {
    if (enabledServersById[serverId] === undefined) {
        enabledServersById[serverId] = await XPData.findOne({serverId, enabled: true}) !== null
    }
    return enabledServersById[serverId];
}

async function getGuildById(serverId: string) {
    if (guildsById[serverId] === undefined) {
        guildsById[serverId] = client.guilds.cache.get(serverId) ?? null
    }
    return guildsById[serverId];
}

async function getMemberById(serverId: string, memberId: string) {
    if (membersById[memberId] === undefined) {
        const guild = await getGuildById(serverId);
        membersById[memberId] = guild !== null ? await guild.members.fetch(memberId).catch(() => null) : null
    }
    return membersById[memberId];
}

function getPromiseArrayFromButton(button: IXPNotificationAskButton|IXPTipsUsefulAskButton) {
    return [
        button.remove(),
        (async () => {
            if (!(<IXPTipsUsefulAskButton>button).useful && !(<IXPNotificationAskButton>button).toEnable)
                return;
            const member = await getMemberById(button.serverId, button.userId);
            if (member !== null)
                return deleteMP(member.user, button.messageId);
        })()
    ]
}

client.on('ready', async () => {
    const currentDate = new Date()

    const XPNotificationAskButtons: IXPNotificationAskButton[] = await XPNotificationAskButton.find({
        timestamps: {$lte: new Date(currentDate.getTime() - XPNotificationAskButtonTimeout)}
    })

    const XPTipsUsefulAskButtons: IXPTipsUsefulAskButton[] = await XPTipsUsefulAskButton.find({
        timestamps: {$lte: new Date(currentDate.getTime() - XPTipsUsefulAskButtonTimeout)}
    })

    console.log(XPNotificationAskButtons.length+" ask notifications buttons cleaned")
    console.log(XPTipsUsefulAskButtons.length+" ask tips buttons cleaned")

    await Promise.all([
        Promise.all(XPNotificationAskButtons.map(button => 
            Promise.all([
                ...getPromiseArrayFromButton(button),
                ...(
                    button.toEnable ? [
                        serverHasXPsEnabled(button.serverId)
                            .then(async enabled => {
                                if (!enabled)
                                    return;
                                const member = await getMemberById(button.serverId, button.userId);
                                if (member === null)
                                    return;
                                
                                return askForNotifications(
                                    member.user, 
                                    button.serverId, 
                                    "Il semblerait que vous n'avez pas encore répondu.\n"+
                                    "Voulez vous activer les notifications sur le serveur '"+member.guild.name+"'?"
                                )
                            })
                    ] : []
                )
            ])
        )),
        Promise.all(XPTipsUsefulAskButtons.map(async button => 
            Promise.all(getPromiseArrayFromButton(button))
        ))
    ]).catch(e => {
        console.log("ERROR -> ")
        console.log(e);
    })
    process.exit();
})