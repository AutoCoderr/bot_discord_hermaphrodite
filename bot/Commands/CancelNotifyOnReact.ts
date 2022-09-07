import config from "../config";
import Command from "../Classes/Command";
import {forEachNotifyOnReact} from "../Classes/OtherFunctions";
import { existingCommands } from "../Classes/CommandsDescription";
import StoredNotifyOnReact from "../Models/StoredNotifyOnReact";
import Discord, {
    ClientUser,
    CommandInteractionOptionResolver, Emoji,
    Guild,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message,
    MessageEmbed, MessageReaction, Snowflake,
    TextChannel,
    User
} from "discord.js";
import {checkTypes} from "../Classes/TypeChecker";
import client from "../client";

export default class CancelNotifyOnReact extends Command {
    static description = "Pour désactiver l'écoute d'une réaction sur un ou plusieurs messages.";
    static display = true;
    static commandName = "cancelNotifyOnReact"

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel = {
        all: {
            fields: ["--all"],
            type: "boolean",
            description: "à mettre sans rien d'autre, pour désactiver l'écoute sur tout les messages",
            required: false
        },
        channel: {
            fields: ["--channel","-ch"],
            type:"channel",
            description: "Spécifier le channel sur lequel désactifier l'écoute de réaction",
            required: (args, _, modelizeSlashCommand = false) => !modelizeSlashCommand && (args.all == undefined || !args.all)
        },
        emote: {
            fields: ["--emote", "-e"],
            type: "emote",
            description: "Spécifier l'émote pour laquelle il faut désactiver l'écoute (nécessite --channel et --message)",
            required: false
        },
        message: {
            fields: ["--message", "-m"],
            type: "message",
            description: "Spécifier l'id du message sur lequel désactiver l'écoute (nécessite le champs --channel)",
            required: (args, _, modelizeSlashCommand = false) => !modelizeSlashCommand && args.emote != undefined,
            moreDatas: (args) => args.channel
        }
    };

    constructor(channel: TextChannel, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, CancelNotifyOnReact.commandName, CancelNotifyOnReact.argsModel);
    }

    async action(args: {channel: GuildChannel, message: Message, emote: GuildEmoji|string, all: boolean},bot) {
        let {channel,message,emote, all} = args;

        if (this.guild == null || this.member == null) {
            return this.response(
                false,
                this.sendErrors({
                    name: "Missing data",
                    value: "We can't find guild or member"
                })
            );
        }
        if (message && message.guild == null) {
            return this.response(
                false,
                this.sendErrors({
                    name: "Missing data",
                    value: "We can't find guild"
                })
            );
        }

        let emoteKey: undefined|string|Snowflake = emote ? (emote instanceof GuildEmoji ? emote.id : emote) : undefined;

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('écoutes de réactions désactivées:')
            .setDescription("Ceci est la liste des écoutes de réactions désactivées :")
            .setTimestamp();
        // @ts-ignore
        let listenings = existingCommands.NotifyOnReact.listenings[this.guild.id];

        if (emoteKey === undefined || all) {
            await CancelNotifyOnReact.deleteNotifyOnReactInBdd(this.guild.id, (channel && !all) ? channel.id : null, (message && !all) ? message.id : null)
            await forEachNotifyOnReact(async (found, channel, message: Message, contentMessage, emoteKey) => {
                if (found) { // @ts-ignore
                    listenings[channel.id][message.id][emoteKey] = false;

                    let emote: Emoji|null = checkTypes.id(emoteKey) ? (<Guild>this.guild).emojis.cache.get(emoteKey)??null : null
                    const reaction: null|MessageReaction = message.reactions.cache.find(reaction => (reaction.emoji.id??reaction.emoji.name) === emoteKey)??null;
                    if (reaction)
                        await reaction.users.remove(<ClientUser>client.user);

                    if (checkTypes.id(emoteKey) && emote === null && reaction) {
                        emote = reaction.emoji;
                    }

                    Embed.addField(
                        "Supprimée : sur '#" + channel.name + "' (" + contentMessage + ") " + (emote ? ':'+emote.name+':' : emoteKey),
                        "Cette écoute de réaction a été supprimée"
                    );
                } else {
                    Embed.addField("Aucune réaction", "Aucune réaction n'a été trouvée et supprimée");
                }
            }, all ? undefined : channel, all ? undefined : message, Embed, this);
        } else if (listenings && listenings[channel.id] && listenings[channel.id][message.id] && listenings[channel.id][message.id][emoteKey]) {
            await CancelNotifyOnReact.deleteNotifyOnReactInBdd(this.guild.id,channel.id,message.id,emoteKey);
            listenings[channel.id][message.id][emoteKey] = false;
            if (emote instanceof Emoji) {
                await CancelNotifyOnReact.deleteNotifyOnReactInBdd(this.guild.id,channel.id,message.id,emote.name);
            }
            const reaction = message.reactions.cache.find(reaction => reaction.emoji.id === (<Emoji>emote).id);
            if (reaction) {
                await reaction.users.remove(<ClientUser>client.user);
            }
            Embed.addField(
                "sur '#" + channel.name + "' (" + message.content + ") "+(emote instanceof Emoji ? ':'+emote.name+':' : emoteKey),
                "Cette écoute de réaction a été supprimée"
            );
        } else {
            Embed.addField(
                "Aucune réaction",
                "Aucune réaction n'a été trouvée et supprimée"
            );
        }
        return this.response(true, {embeds: [Embed]});
    }

    static async deleteNotifyOnReactInBdd(serverId, channelId: Snowflake|null = null, messageId: Snowflake|null = null, emoteKey: Snowflake|null = null) {
        await StoredNotifyOnReact.deleteMany({
            serverId: serverId,
            ...( channelId ? {channelToListenId: channelId} : {}),
            ...(messageId ? {messageToListenId: messageId} : {}),
            ...(emoteKey ? {$or: [{emoteName: emoteKey}, {emoteId: emoteKey}]} : {})
        });
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields(<any>[
                {
                    name: "--channel #channel",
                    value: "Désactiver les écoutes de réaction du channel #channel"
                },
                {
                    name: "--channel #channel --message idDuMessage",
                    value: "Désactiver les écoutes de réaction du channel #channel sur le message spécifié par son id"
                },
                {
                    name: "-ch #channel -m idDuMessage -e :emote:",
                    value: "Désactiver les écoutes de réaction du channel #channel sur le message spécifié par son id, sur l'émote mentionnée"
                },
                {
                    name: "--all",
                    value: "Désactiver toutes les écoutes de réactions du serveur"
                },
                {
                    name: "-h",
                    value: "Afficher l'aide"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })))
    }

}
