import {existingCommands} from "./Classes/CommandsDescription";
import {getExistingCommands} from "./Classes/CommandsDescription";
import client from "./client";
import {GuildMember, Interaction, VoiceState} from "discord.js";
import {initSlashCommands, initSlashCommandsOnGuild, listenSlashCommands} from "./slashCommands";
import {listenInviteButtons, listenAskInviteBackButtons} from "./Classes/TextAndVocalFunctions";
import {listenCustomCommands} from "./listenCustomCommands";
import CustomError from "./logging/CustomError";
import reportError from "./logging/reportError";
import {
    listenXPNotificationAskButtons
} from "./libs/XP/XPOtherFunctions";
import {listenXPTipsUseFulApproveButtons} from "./libs/XP/tips/tipsOtherFunctions";
import {listenXPArrowsTipsButtons} from "./libs/XP/tips/tipsBrowsing";
import countingVocalXPs from "./libs/XP/XPCounting/countingVocalXPs";
import countingMessagesXPs from "./libs/XP/XPCounting/countingMessagesXPs";
import countingFirstMessagesXPs from "./libs/XP/XPCounting/countingFirstMessagesXPs";
import {findAndExecCallbackButton} from "./libs/callbackButtons";
import { findAndExecCallbackModal } from "./libs/callbackModals";
import { countingStatsMessagesEvent, countingStatsVoiceConnectionsAndMinutesEvent } from "./libs/stats/statsCounters";
import setDefaultStatsOnNewGuild from "./libs/stats/setDefaultStatsOnNewGuild";

export default function init(bot) {
    client.on('ready', () => {
        getExistingCommands().then(() => {
            //@ts-ignore
            existingCommands.NotifyOnReact.applyNotifyOnReactAtStarting(bot)
                .catch(e => {
                    reportError(new CustomError(e, {from: "listeningNotifyOnReact"}));
                })
            //@ts-ignore
            existingCommands.Monitor.initAllEventListeners()
                .catch(e => {
                    reportError(new CustomError(e, {from: "listeningMonitoring"}));
                })
            //@ts-ignore
            existingCommands.ConfigTicket.initListeningAllMessages()
                .catch(e => {
                    reportError(new CustomError(e, {from: "initTicketMessageListening"}));
                })

            initSlashCommands()
                .catch(e => {
                    reportError(new CustomError(e, {from: "initSlashCommands"}));
                });

            client.on('guildCreate', async guild => {
                try {
                    await initSlashCommandsOnGuild(guild);
                } catch (e) {
                    reportError(new CustomError(<Error>e, {from: "guildCreate", guild}));
                }
                try {
                    await setDefaultStatsOnNewGuild(guild);
                } catch(e) {
                    reportError(new CustomError(<Error>e, {from: "setDefaultStats", guild}));
                }
            });

            client.on('interactionCreate', async (interaction: Interaction) => {
                try {
                    if (interaction.isButton()) {
                        if (await findAndExecCallbackButton(interaction)) {
                            return;
                        }
                        await interaction.deferReply({ephemeral: true});
                        if (await Promise.all([
                            listenInviteButtons(interaction, 'text'),
                            listenInviteButtons(interaction, 'vocal'),
                            listenAskInviteBackButtons(interaction, 'text'),
                            listenAskInviteBackButtons(interaction, 'vocal'),
                            listenXPNotificationAskButtons(interaction),
                            listenXPTipsUseFulApproveButtons(interaction),
                            listenXPArrowsTipsButtons(interaction),
                            
                        ]).then(responses => !responses.includes(true))) {
                            await interaction.editReply({content: "Bouton invalide"});
                        }
                        return;
                    }

                    if (interaction.isModalSubmit()) {
                        await findAndExecCallbackModal(interaction);
                    }

                    if (interaction.isCommand())
                        await listenSlashCommands(interaction)
                            .catch(async e => {
                                throw new CustomError(e, {
                                    from: 'slashCommand',
                                    command: interaction.commandName,
                                    commandId: interaction.commandId
                                })
                            })
                } catch(e) {
                    if (interaction.isCommand() || interaction.isButton()) {
                        if (!interaction.deferred) {
                            await interaction.deferReply({
                                ephemeral: true
                            });
                        }
                        await interaction.editReply({content: "Une erreur interne est survenue"})
                    }
                    reportError(new CustomError(<CustomError>e, {
                        user: (<GuildMember>interaction.member) ?? interaction.user,
                        channel: interaction.channel ?? undefined,
                        guild: interaction.guild ?? undefined
                    }))
                }
            });

            client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
                //@ts-ignore
                existingCommands.Vocal.listenVoiceChannelsConnects(oldState, newState)
                    .catch(e => {
                        reportError(new CustomError(e, {
                            from: "voiceConnect",
                            newVoiceState: newState,
                            oldVoiceState: oldState,
                            guild: newState.guild,
                            channel: newState.channel??undefined,
                            user: newState.member??undefined
                        }))
                    })
                countingVocalXPs(oldState, newState);
                countingStatsVoiceConnectionsAndMinutesEvent(oldState, newState);
            })

            client.on("messageCreate", async message => {
                try {
                    await Promise.all([
                        listenCustomCommands(message),

                        countingStatsMessagesEvent(message),
                        //@ts-ignore
                        existingCommands.ConfigWelcome.listenJoinsToWelcome(message),
                        //@ts-ignore
                        existingCommands.Text.listenTextMessages(message),
                        (async () => {
                            await countingMessagesXPs(message);
                            await countingFirstMessagesXPs(message);
                        })()
                    ])
                } catch(e) {
                    reportError(new CustomError(<Error|CustomError>e, {
                        from: (e instanceof CustomError && e.data && e.data.from) ? e.data.from : "messageCreate",
                        message,
                        guild: message.guild??undefined,
                        channel: message.channel,
                        user: message.member??message.author
                    }))
                }
            })
        })
    });
}
