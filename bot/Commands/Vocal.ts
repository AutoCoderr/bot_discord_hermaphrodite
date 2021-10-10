import Command from "../Classes/Command";
import {GuildChannel, GuildMember, Message, MessageEmbed, VoiceChannel} from "discord.js";
import config from "../config";

export default class Vocal extends Command {
    static display = true;
    static description = "Être alerté quand une ou plusieurs personnes se connectent à un ou plusieurs channels";
    static commandName = "vocal";

    constructor(message: Message) {
        super(message, Vocal.commandName);
    }

    argsModel = {
        help: { fields: ["-h","--help"], type: "boolean", required: false, description: "Pour afficher l'aide" },

        $argsByType: {
            action: {
                required: (args) => args.help == undefined,
                type: "string",
                default: "subscribe",
                description: "L'action à effectuer : subscribe, info, clear, all, limit, mute",
                valid: (field) => ['subscribe','info','clear','all','limit','mute'].includes(field)
            },
            channels: {
                required: false,
                displayValidError: true,
                type: "channels",
                description: "Le ou les channels vocaux sur lesquels écouter",
                valid: (channels: GuildChannel[]) => !channels.some(channel => channel.type != "GUILD_VOICE"),
                errorMessage: () => ({
                    name: "Channels non ou mal rentré",
                    value: "Vous n'avez pas ou mal renseigné vos channels, ils ne peuvent qu'être des channels vocaux"
                })
            },
            users: {
                required: (args) => args.help == undefined && args.action == "subscribe" && args.channels == undefined,
                type: "users",
                description: "Le ou les utilisateurs à écouter quand ils se connectent sur un vocal",
                errorMessage: (value, args) => (value == undefined && args.channels == undefined) ?
                        {
                            name: "Rentrez au moins l'un des deux",
                            value: "Vous devez avoir mentionné au moins un utilisateur ou un channel. Vous pouvez également utiliser l'action 'all'"
                        } : {
                            name: "Utilisateurs non ou mal renseigné",
                            value: "Vous n'avez pas ou mal renseigné "
                        }
            },
            time: {
                required: (args) => args.help == undefined && ["limit","mute"].includes(args.action),
                type: "duration",
                description: "Le temps durant lequel on souhaite ne pas recevoir de notif"
            }
        }
    }

    async action(args: {help: boolean, action: string, channels: VoiceChannel[], users: GuildMember[]}) {
        const {help, action, channels, users} = args;

        if (help) {
            this.displayHelp();
            return false;
        }

        console.log(args);

        return false;
    }

    help(Embed: MessageEmbed) {
        Embed.addFields({
            name: "Exemples :",
            value:
                config.command_prefix+this.commandName+" @user1,@user2, #!channel1,#!channel2\n"+
                config.command_prefix+this.commandName+" #!channel1,#!channel2\n"+
                config.command_prefix+this.commandName+" @user1\n"+
                config.command_prefix+this.commandName+" all\n"+
                config.command_prefix+this.commandName+" info \n"+
                config.command_prefix+this.commandName+" clear \n"+
                config.command_prefix+this.commandName+" limit 'time' | exemples pour time: 30s, 1h, 5m, 1j\n"+
                config.command_prefix+this.commandName+" mute 'time'\n"+
                config.command_prefix+this.commandName+" -h"
        });
    }
}