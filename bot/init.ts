import {existingCommands} from "./Classes/CommandsDescription";
import {getExistingCommands} from "./Classes/CommandsDescription";
import client from "./client";
import {GuildMember, Interaction, VoiceState} from "discord.js";
import {initSlashCommands, initSlashCommandsOnGuild, listenSlashCommands} from "./slashCommands";
import {listenInviteButtons, listenAskInviteBackButtons} from "./Classes/TextAndVocalFunctions";
import {listenCustomCommands} from "./listenCustomCommands";
import CustomError from "./logging/CustomError";
import reportError from "./logging/reportError";

export default function init(bot) {
    client.on('ready', () => {
        getExistingCommands().then(() => {
            //@ts-ignore
            existingCommands.NotifyOnReact.applyNotifyOnReactAtStarting(bot);
            //@ts-ignore
            existingCommands.Monitor.initAllEventListeners();
            //@ts-ignore
            existingCommands.ConfigTicket.initListeningAllMessages();

            initSlashCommands()
                .catch(e => {
                    reportError(new CustomError(e, {from: "initSlashCommands"}));
                });

            client.on('guildCreate', guild => initSlashCommandsOnGuild(guild).catch(e => {
                reportError(new CustomError(e, {from: "guildCreate", guild}))
            }));

            client.on('interactionCreate', async (interaction: Interaction) => {
                try {
                    if (interaction.isButton()) {
                        await interaction.deferReply();
                        if (await Promise.all([
                            listenInviteButtons(interaction, 'text'),
                            listenInviteButtons(interaction, 'vocal'),
                            listenAskInviteBackButtons(interaction, 'text'),
                            listenAskInviteBackButtons(interaction, 'vocal')
                        ]).then(responses => !responses.includes(true))) {
                            await interaction.editReply({content: "Bouton invalide"});
                        }
                        return;
                    }

                    if (interaction.isCommand())
                        await listenSlashCommands(interaction)
                            .catch(async e => {
                                throw new CustomError(e, {
                                    from: 'slashCommand',
                                    command: interaction.commandName,
                                    commandId: interaction.commandId,
                                    user: (<GuildMember>interaction.member) ?? interaction.user,
                                    channel: interaction.channel ?? undefined,
                                    guild: interaction.guild ?? undefined
                                })
                            })
                } catch(e) {
                    if (interaction.isCommand() || interaction.isButton())
                        await interaction.editReply({content: "Une erreur interne est survenue"})
                    reportError(<Error|CustomError> e)
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
            })

            client.on("messageCreate", async message => {
                try {
                    await listenCustomCommands(message)

                    //@ts-ignore
                    await existingCommands.ConfigWelcome.listenJoinsToWelcome(message)

                    //@ts-ignore
                    await existingCommands.Text.listenTextMessages(message)

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
