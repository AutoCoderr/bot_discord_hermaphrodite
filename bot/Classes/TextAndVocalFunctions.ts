import {
    ButtonInteraction,
    Guild,
    GuildChannel,
    GuildMember,
    MessageActionRow,
    MessageButton,
    ThreadChannel
} from "discord.js";
import TextInvite, {ITextInvite} from "../Models/Text/TextInvite";
import TextAskInviteBack, {ITextAskInviteBack} from "../Models/Text/TextAskInviteBack";
import client from "../client";
import Vocal from "../Commands/Vocal";
import VocalUserConfig from "../Models/Vocal/VocalUserConfig";
import VocalSubscribe from "../Models/Vocal/VocalSubscribe";
import VocalInvite from "../Models/Vocal/VocalInvite";
import VocalAskInviteBack from "../Models/Vocal/VocalAskInviteBack";
import Text from "../Commands/Text";
import TextUserConfig from "../Models/Text/TextUserConfig";
import TextSubscribe from "../Models/Text/TextSubscribe";

interface getDatasButtonFunctionResponse {
    server: Guild;
    requester: GuildMember;
    requested: GuildMember;
    channels: Array<GuildChannel | ThreadChannel | undefined> | null;
    keywords: string[] | null;
}

export async function getDatasButton(button: ITextInvite | ITextAskInviteBack, interaction: ButtonInteraction, type: 'text' | 'vocal'): Promise<false | getDatasButtonFunctionResponse> {
    let server: Guild | undefined = undefined;
    if ((server = client.guilds.cache.get(button.serverId)) === undefined) {
        await interaction.editReply({content: "Le serveur associé à cette invitation semble inaccessible au bot"});
        return false;
    }
    let requested: null | GuildMember = null;
    try {
        requested = await server.members.fetch(button.requestedId);
    } catch (_) {
        await interaction.editReply("Vous ne vous trouvez visiblement plus sur le serveur " + server.name);
        return false;
    }
    let requester: null | GuildMember = null;
    if (requested !== null) {
        try {
            requester = await server.members.fetch(button.requesterId);
        } catch (_) {
            await interaction.editReply("L'envoyeur de cette invitation est introuvable sur le serveur " + server.name);
            return false;
        }
    }

    let channels: Array<GuildChannel | ThreadChannel | undefined> | null = null;
    let keywords: string[] | null = null;
    if (type === 'text') {
        let notFoundChannelsId: string[] = [];
        if (button.channelsId && button.channelsId.length > 0 &&
            (channels = button.channelsId.map(channelId => {
                const channel = (<Guild>server).channels.cache.get(channelId);
                if (channel === undefined)
                    notFoundChannelsId.push(channelId);
                return channel;
            })) &&
            notFoundChannelsId.length > 0
        ) {
            await interaction.editReply("Les channels avec les ids : " + notFoundChannelsId.join(", ") + " sont introuvable");
            return false;
        }
        keywords = (button.keywords && button.keywords.length > 0) ? button.keywords : null;
    }

    return (requester && requested) ? {server, requested, requester, channels, keywords} : false;
}

const classesBySubscribeType = {
    vocal: {
        command: Vocal,
        userConfigModel: VocalUserConfig,
        subscribeModel: VocalSubscribe,
        inviteModel: VocalInvite,
        inviteBackModel: VocalAskInviteBack
    },
    text: {
        command: Text,
        userConfigModel: TextUserConfig,
        subscribeModel: TextSubscribe,
        inviteModel: TextInvite,
        inviteBackModel: TextAskInviteBack
    }
}

export async function listenAskInviteBackButtons(interaction: ButtonInteraction, type: 'text' | 'vocal'): Promise<boolean> {
    const {command, inviteBackModel} = classesBySubscribeType[type]

    const currentDate = new Date();
    await inviteBackModel.deleteMany({
        timestamp: {$lte: new Date(currentDate.getTime() - command.buttonsTimeout)}
    });
    const inviteBackButton = await inviteBackModel.findOne({
        buttonId: interaction.customId
    });

    if (inviteBackButton === null)
        return false;

    const datas = await getDatasButton(inviteBackButton, interaction, type);
    if (!datas)
        return false;

    const {server, requested, requester, channels, keywords} = datas;

    await command.sendInvite(requester, requested, server, channels ? channels.map(channel => (<GuildChannel>channel).id) : undefined, keywords ?? undefined);

    await inviteBackButton.remove();

    await interaction.editReply({content: "Invitation envoyée en retour"});

    return true;
}

async function inviteBack(interaction: ButtonInteraction, requester: GuildMember, requested: GuildMember, server: Guild, type: 'text' | 'vocal', keywords: string[] | null = null, channelsId: string[] | null = null) {
    const {inviteBackModel} = classesBySubscribeType[type];

    const askBackButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "a";

    await interaction.editReply({
        content: "Invitation acceptée",
        components: [
            new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId(askBackButtonId)
                    .setLabel("Inviter en retour")
                    .setStyle("PRIMARY")
            )
        ]
    });

    await inviteBackModel.create({
        buttonId: askBackButtonId,
        requesterId: requested.id,
        requestedId: requester.id,
        timestamp: new Date(),
        ...(channelsId ? {channelsId} : {}),
        ...(keywords ? {keywords} : {}),
        serverId: server.id
    });
}

export async function listenInviteButtons(interaction: ButtonInteraction, type: 'text' | 'vocal'): Promise<boolean> {

    const {command, inviteModel, userConfigModel, subscribeModel} = classesBySubscribeType[type]

    const currentDate = new Date();
    await inviteModel.deleteMany({
        timestamp: {$lte: new Date(currentDate.getTime() - Vocal.buttonsTimeout)}
    });

    const invite = await inviteModel.findOne({
        buttonId: interaction.customId
    })

    if (invite === null)
        return false;

    if (invite.inviteId === undefined) {
        invite.remove();
        return false;
    }

    const datas = await getDatasButton(invite, interaction, type);
    if (!datas)
        return false;
    const {server, requested, requester, channels, keywords} = datas;

    if (!(await command.staticCheckPermissions(null, requested, server, false))) {
        await interaction.editReply({content: "Vous n'avez plus accès à la fonction vocal sur le serveur '" + server.name + "'"});
        return true;
    }
    if (!(await command.staticCheckPermissions(null, requester, server, false))) {
        await interaction.editReply({content: "'" + (requester.nickname ?? requester.user.username) + "' n'a plus accès à la fonction vocal sur le serveur '" + server.name + "'"});
        return true;
    }

    if (invite.accept) {
        const listenerConfig = await userConfigModel.findOne({
            serverId: server.id,
            listenerId: invite.requesterId
        });
        const listenerListening = listenerConfig ? (
            listenerConfig.listening !== undefined ?
                listenerConfig.listening :
                (!listenerConfig.lastMute || listenerConfig.mutedFor)
        ) : true;
        if (channels) {
            const existingSubscribeAllChannels = await subscribeModel.findOne({
               serverId: server.id,
               listenerId: requester.id,
               listenedId: requested.id,
               channelId: {$exists: false}
            });
            for (const channel of <Array<GuildChannel | ThreadChannel>>channels) {
                const existingSubscribe = await subscribeModel.findOne({
                    serverId: invite.serverId,
                    listenerId: invite.requesterId,
                    listenedId: invite.requestedId,
                    channelId: channel.id,
                });
                if (existingSubscribe) {
                    existingSubscribe.keywords = keywords ? [...(existingSubscribe.keywords??[]), ...keywords] : undefined;
                    if (existingSubscribeAllChannels && compareKeyWords(existingSubscribe.keywords, existingSubscribeAllChannels.keywords)) {
                        existingSubscribe.remove();
                    } else {
                        existingSubscribe.save();
                    }
                } else if (existingSubscribeAllChannels === null || keywords || (existingSubscribeAllChannels.keywords !== undefined && existingSubscribeAllChannels.keywords.length > 0)) {
                    await subscribeModel.create({
                        serverId: invite.serverId,
                        listenerId: invite.requesterId,
                        listenedId: invite.requestedId,
                        channelId: channel.id,
                        ...(keywords ? {keywords: [...(existingSubscribeAllChannels ? (existingSubscribeAllChannels.keywords??[]) : []), ...keywords]} : {}),
                        timestamp: new Date,
                        enabled: listenerListening,
                    });
                }
            }
        } else {
            await subscribeModel.create({
                serverId: invite.serverId,
                listenerId: invite.requesterId,
                listenedId: invite.requestedId,
                ...(keywords ? {keywords} : {}),
                timestamp: new Date,
                enabled: listenerListening
            });
            if (keywords) {
                const existingSubscribesOnSpecificChannel = await subscribeModel.find({
                    serverId: server.id,
                    listenerId: invite.requesterId,
                    listenedId: invite.requestedId,
                    channelId: {$exists: true}
                });
                for (const subscribe of existingSubscribesOnSpecificChannel) {
                    subscribe.keywords = [...(subscribe.keywords??[]), ...keywords]
                    subscribe.save();
                }
            } else if (type === "text") {
                await subscribeModel.deleteMany({
                    serverId: server.id,
                    listenerId: invite.requesterId,
                    listenedId: invite.requestedId,
                    channelId: {$exists: true}
                });
            }
        }
        try {
            await requester.send((requested.nickname ?? requested.user.username) + " a accepté(e) votre invitation sur '" + server.name + "'" + (!listenerListening ? " (Attention votre écoute n'est pas activée sur ce serveur)" : ""));
        } catch (_) {
        }
        let backInviteSent = false;

        const [backSubscribeAllChannels,existingBackInviteAllChannels] = await Promise.all([
            subscribeModel.findOne({
                serverId: server.id,
                listenerId: requested.id,
                listenedId: requester.id,
                ...(type === "text" ? {channelId: {$exists: false}} : {})
            }),
            inviteModel.findOne({
                serverId: server.id,
                requesterId: requested.id,
                requestedId: requester.id,
                ...(type === "text" ? {"channelsId.0": {$exists: false}} : {})
            })
        ]);

        if (existingBackInviteAllChannels === null && backSubscribeAllChannels === null) {
            if (channels) {
                const channelsIdForBackInvite: string[] = [];
                for (const channel of <Array<GuildChannel | ThreadChannel>>channels) {
                    const existingSubscribe = await subscribeModel.findOne({
                        serverId: server.id,
                        listenerId: requested.id,
                        listenedId: requester.id,
                        channelId: channel.id
                    });
                    if (existingSubscribe === null) {
                        channelsIdForBackInvite.push(channel.id)
                    }
                }
                if (channelsIdForBackInvite.length > 0) {
                    const existingBackInvite = await inviteModel.findOne({
                        serverId: server.id,
                        requesterId: requested.id,
                        requestedId: requester.id,
                        channelsId: {$all: channelsIdForBackInvite}
                    });
                    if (existingBackInvite === null) {
                        backInviteSent = true
                        await inviteBack(interaction, requester, requested, server, type, keywords, channelsIdForBackInvite);
                    }
                }
            } else {
                backInviteSent = true
                await inviteBack(interaction, requester, requested, server, type, keywords);
            }
        }

        if (!backInviteSent) {
            await interaction.editReply({content: "Invitation acceptée"});
        }

    } else {
        try {
            await requester.send((requested.nickname ?? requested.user.username) + " a refusé(e) votre invitation sur '" + server.name + "'");
        } catch (_) {
        }
        await interaction.editReply({content: "Invitation refusée"});
    }

    await inviteModel.deleteMany({
        inviteId: invite.inviteId
    });

    return true;
}

export function userBlockingUsOrChannel(listenedConfig: typeof TextUserConfig|null, listenedId: string, usersBlockingMe: null|string[] = null, blockedChannelsByUserId: null|{ [userId: string]: string[] } = null, listenerId: string, channelToListenId: string|null = null, checkForUs = true) {
    if (listenedConfig === null)
        return false;
    let foundBlocking;
    if ((foundBlocking = listenedConfig.blocking.find(({userId, channelId}) =>
        (
            checkForUs &&
            userId === listenerId &&
            channelId === undefined
        ) || (
            channelToListenId &&
            (userId === undefined || userId === listenerId) &&
            channelId === channelToListenId
        )
    ))) {
        if (checkForUs && usersBlockingMe && !foundBlocking.channelId && !usersBlockingMe.includes(listenedId)) {
            usersBlockingMe.push(listenedId)
        } else if (channelToListenId && blockedChannelsByUserId) {
            if (blockedChannelsByUserId[listenedId] === undefined)
                blockedChannelsByUserId[listenedId] = [];
            blockedChannelsByUserId[listenedId].push(channelToListenId)
        }
        return true;
    }
    return false;
}

export async function reEnableTextSubscribesAfterUnmute(listenerId, serverId) {
    const subscribes = await TextSubscribe.find({
        serverId,
        listenerId,
        enabled: false
    });
    const userConfigById: { [userId: string]: typeof TextUserConfig } = {};
    for (const subscribe of subscribes) {
        if (userConfigById[subscribe.listenedId] === undefined)
            userConfigById[subscribe.listenedId] = await TextUserConfig.findOne({
                serverId,
                userId: subscribe.listenedId
            });

        if (!userBlockingUsOrChannel(userConfigById[subscribe.listenedId], subscribe.listenedId, null, null, listenerId, subscribe.channelId ?? null)) {
            subscribe.enabled = true;
            subscribe.save();
        }
    }
}

export async function reEnableTextSubscribesAfterUnblock(listenedId, serverId, listenerId: null|string = null, channelId: null|string = null) {
    const subscribes = await TextSubscribe.find({
        serverId,
        listenedId,
        ...(listenerId ? {listenerId} : {}),
        ...(channelId ? {channelId} : {}),
        enabled: false
    });
    const userConfigById: { [userId: string]: typeof TextUserConfig } = {};

    for (const subscribe of subscribes) {
        if (userConfigById[subscribe.listenerId] === undefined)
            userConfigById[subscribe.listenerId] = await TextUserConfig.findOne({
                serverId: serverId,
                userId: subscribe.listenerId
            });

        if (userConfigById[subscribe.listenerId] && (userConfigById[subscribe.listenerId].lastMute === undefined || userConfigById[subscribe.listenerId].mutedFor)) {
            subscribe.enabled = true;
            subscribe.save();
        }

    }
}

export function compareKeyWords(A: string[]|undefined,B: string[]|undefined) {
    if ((A === undefined) !== (B === undefined))
        return false;
    if (A === undefined || B === undefined)
        return true;

    if (A.length !== B.length)
        return false;

    return !A.some(w => !B.includes(w));
}

export function removeKeyWords(L: string[]|undefined, toRemove: string[]) {
    if (L === undefined) return undefined
    const newL = L.filter(w => !toRemove.includes(w));
    return newL.length > 0 ? newL : undefined;
}
