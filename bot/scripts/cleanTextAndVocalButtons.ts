import { deleteMP } from "../Classes/OtherFunctions";
import client from "../client";
import { getMemberById } from "../libs/cacheForScripts";
import TextAskInviteBack, { ITextAskInviteBack, TextAskInviteBackTimeout } from "../Models/Text/TextAskInviteBack";
import TextInvite, { ITextInvite, TextInviteTimeout } from "../Models/Text/TextInvite";
import VocalAskInviteBack, { IVocalAskInviteBack, VocalAskInviteBackTimeout } from "../Models/Vocal/VocalAskInviteBack";
import VocalInvite, { IVocalInvite, VocalInviteTimeout } from "../Models/Vocal/VocalInvite";

interface IMessageIdDefined {
    messageId: string
}

client.on('ready', async () => {
    const currentDate = new Date();

    const [
        expiredVocalInvites,
        expiredVocalAskInvitesBack,
        expiredTextInvites,
        expiredTextAskInvitesBack
    ] = await 
        <Promise<
            [
                (IVocalInvite&IMessageIdDefined)[], 
                (IVocalAskInviteBack&IMessageIdDefined)[], 
                (ITextInvite&IMessageIdDefined)[], 
                (ITextAskInviteBack&IMessageIdDefined)[]
            ]>>
        Promise.all(
            [
                [VocalInvite, VocalInviteTimeout],
                [VocalAskInviteBack, VocalAskInviteBackTimeout],
                [TextInvite, TextInviteTimeout],
                [TextAskInviteBack, TextAskInviteBackTimeout]
            ].map(([model,timeout]) =>
                model.find({
                    messageId: {$exists: true},
                    timestamp: {$lte: new Date(currentDate.getTime() - timeout)}
                })
            )).catch(e => {
                console.log("ERROR ->");
                console.log(e);
            });

    console.log(expiredVocalInvites.length+" vocal invites found to clean")
    console.log(expiredVocalAskInvitesBack.length+" vocal ask invites back found to clean")
    console.log(expiredTextInvites.length+" text invites found to clean")
    console.log(expiredTextAskInvitesBack.length+" text ask invites back found to clean")

    await Promise.all(
        [
            <[(IVocalInvite&IMessageIdDefined)[],string]>[expiredVocalInvites, 'requestedId'],
            <[(IVocalAskInviteBack&IMessageIdDefined)[],string]>[expiredVocalAskInvitesBack, 'requesterId'],
            <[(ITextInvite&IMessageIdDefined)[],string]>[expiredTextInvites, 'requestedId'],
            <[(ITextAskInviteBack&IMessageIdDefined)[],string]>[expiredTextAskInvitesBack, 'requesterId']
        ].map(([buttons,userCol]) => 
            Promise.all(
                buttons.map(async (button) => 
                    Promise.all([
                        button.remove(),
                        getMemberById(button.serverId, button[userCol])
                            .then(member => 
                                member !== null ?
                                    deleteMP(member.user, button.messageId) :
                                    null
                            )
                    ])
                )
            )
        )
    )

    if ([expiredVocalInvites, expiredVocalAskInvitesBack, expiredTextInvites, expiredTextAskInvitesBack].reduce((acc,l) => acc+l.length, 0) > 0)
        console.log("All cleaned");

    process.exit();
})