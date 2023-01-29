import config from "../config";
import {forEachNotifyOnReact} from "../Classes/OtherFunctions";
import Command from "../Classes/Command";
import Discord, {
    CommandInteraction,
    CommandInteractionOptionResolver, EmbedBuilder, Emoji,
    Guild,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message,
    TextChannel,
    User
} from "discord.js";
import {existingCommands} from "../Classes/CommandsDescription";
import {checkTypes} from "../Classes/TypeChecker";
import {IArgsModel} from "../interfaces/CommandInterfaces";

export default class ListNotifyOnReact extends Command {
    static display = true;
    static description = "Pour lister les messages, sur lesquels il y a une écoute de réaction.";
    static commandName = "listNotifyOnReact";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel = {
        $argsByName: {
            all: {
                fields: ["--all"],
                type: "boolean",
                description: "à mettre sans rien d'autre, pour afficher l'écoute sur tout les messages",
                required: false
            },
            channel: {
                fields: ["--channel","-ch"],
                type:"channel",
                description: "Spécifier le channel sur lequel afficher les écoutes de réaction",
                required: (args, _, modelizeSlashCommand = false) => !modelizeSlashCommand && (args.all == undefined || !args.all)
            },
            emote: {
                fields: ["--emote", "-e"],
                type: "emote",
                description: "Spécifier l'émote pour laquelle il faut afficher l'écoute (nécessite --channel et --message)",
                required: false
            },
            message: {
                fields: ["--message", "-m"],
                type: "message",
                description: "Spécifier l'id du message sur lequel afficher les écoutes (nécessite de spécifier le channel)",
                required: (args, _, modelizeSlashCommand = false) => !modelizeSlashCommand && args.emote != undefined,
                moreDatas: (args) => args.channel
            }
        }
    };

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ListNotifyOnReact.commandName, ListNotifyOnReact.argsModel);
    }

    async action(args: {channel: GuildChannel, message: Message, emote: GuildEmoji|string, all: boolean}, bot) {
        let {channel,message,emote, all} = args;

        if (this.guild == null) return this.response(false,
            this.sendErrors({
                name: "Guild missing",
                value: "We cannot find the guild"
            })
        );

        let emoteKey = emote ? (emote instanceof GuildEmoji ? emote.id : emote) : undefined;

        // Affiche dans un Embed, l'ensemble des écoutes de réactions qu'il y a

        let Embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Listes des écoutes de réactions :')
            .setDescription("Ceci est la liste des écoutes de réactions :")
            .setTimestamp();

        // @ts-ignore
        let listenings = existingCommands.NotifyOnReact.listenings[this.guild.id];

        if (emoteKey == undefined || all) {
            await forEachNotifyOnReact(async (found, channel: TextChannel, message: Message, contentMessage, emoteKey) => {
                let emote: Emoji|null = checkTypes.id(emoteKey) ? (<Guild>this.guild).emojis.cache.get(emoteKey)??null : null;
                if (checkTypes.id(emoteKey) && emote === null) {
                    const reaction = message.reactions.cache.find(reaction => reaction.emoji.id === emoteKey);
                    emote = reaction ? reaction.emoji : null
                }
                if (found) {
                    Embed.addFields({
                        name: "Sur '#" +channel.name + "' (" + contentMessage + ") " + (emote ? ':' + emote.name + ':' : emoteKey),
                        value: "Il y a une écoute de réaction sur ce message"
                    });
                } else {
                    Embed.addFields({
                        name: "Aucune réaction",
                        value: "Aucune réaction n'a été trouvée"
                    });
                }
            }, all ? undefined : channel, all ? undefined : message, Embed, this);
        } else if (listenings && listenings[channel.id] && listenings[channel.id][message.id] && listenings[channel.id][message.id][emoteKey]) {
            const contentMessage = message.content.substring(0,Math.min(20,message.content.length)) + "...";
            Embed.addFields({
                name: "sur '#" +channel.name + "' (" + contentMessage + ") " + (emote instanceof GuildEmoji ? ':' + emote.name + ':' : emote),
                value: "Il y a une écoute de réaction sur ce message"
            });
        } else {
            Embed.addFields({
                name: "Aucune réaction",
                value: "Aucune réaction n'a été trouvée et supprimée"
            });
        }

        return this.response(true, {embeds: [Embed]});
    }

    help() {
        return new EmbedBuilder()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "--channel #leChannel",
                    value: "Lister les écoutes de réaction du channel #leChannel"
                },
                {
                    name: "--channel #leChannel -m idDuMessage",
                    value: "Lister les écoutes de réaction du channel #leChannel sur le message mentionné"
                },
                {
                    name: "--all",
                    value: "Afficher toutes les écoutes de réaction du serveur"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })));
    }
}
