import { deleteMP, getMP } from "../../Classes/OtherFunctions";
import { connectClients } from "../../clients";
import { getMemberById, serverHasXPsEnabled } from "../../libs/cacheForScripts";
import { askForNotifications } from "../../libs/XP/XPCounting/countingOtherFunctions";
import XPNotificationAskButton, { IXPNotificationAskButton, XPNotificationAskButtonTimeout } from "../../Models/XP/XPNotificationAskButton"
import XPTipsUsefulAskButton, { IXPTipsUsefulAskButton, XPTipsUsefulAskButtonTimeout } from "../../Models/XP/XPTipsUsefulAskButton";

function getPromiseArrayFromButton(button: IXPNotificationAskButton|IXPTipsUsefulAskButton) {
    return [
        button.remove(),
        (async () => {
            if (!(<IXPTipsUsefulAskButton>button).useful && !(<IXPNotificationAskButton>button).toEnable)
                return;
            const member = await getMemberById(button.serverId, button.userId);
            if (member === null)
                return;

            const message = await getMP(member.user, button.messageId);
            if (message === null)
                return;

            const splittedMessage = message.content.split("\n-------------------------------");
            if (splittedMessage.length > 1)
                await message.edit({
                    content: splittedMessage[0],
                    components: []
                });
            else
                await deleteMP(member.user, message)
        })()
    ]
}

connectClients()
    .then(async () => {
        try  {
            const currentDate = new Date()
    
            const XPNotificationAskButtons: IXPNotificationAskButton[] = await XPNotificationAskButton.find({
                timestamps: {$lte: new Date(currentDate.getTime() - XPNotificationAskButtonTimeout)}
            })
    
            const XPTipsUsefulAskButtons: IXPTipsUsefulAskButton[] = await XPTipsUsefulAskButton.find({
                timestamps: {$lte: new Date(currentDate.getTime() - XPTipsUsefulAskButtonTimeout)}
            })
    
            console.log(XPNotificationAskButtons.length+" ask notifications buttons cleaning")
            console.log(XPTipsUsefulAskButtons.length+" ask tips buttons cleaning")
    
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
            ])
    
            if ([XPNotificationAskButtons,XPTipsUsefulAskButtons].reduce((acc,l) => acc+l.length, 0) > 0)
                console.log("All cleaned");
    
        } catch(e) {
            console.log("ERROR ->");
            console.log(e);
        }
        process.exit();
    })