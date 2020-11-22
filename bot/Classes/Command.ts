import * as Discord from "discord.js";

export default class Command {
    static existingCommands = ["notifyOnReact"];

    static sendErrors(message, errors: Object|Array<Object>, help: null|Function = null){
        if (!(errors instanceof Array)) {
            errors = [errors];
        }
        const commandName = message.content.split(" ")[0];
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Error in '+commandName)
            //.setAuthor('Forbid', 'https://image.noelshack.com/fichiers/2020/34/7/1598188353-icons8-jason-voorhees-500.png')
            .setDescription("There is some errors in your command")
            //.setThumbnail('https://image.noelshack.com/fichiers/2020/34/7/1598188353-icons8-jason-voorhees-500.png')
            .setTimestamp()

        // @ts-ignore
        for (let error of errors) {
            Embed.addFields(
                error
            )
        }
        if (help) {
            help(Embed);
        }

        message.channel.send(Embed);
    }

    static parseCommand(message): any {
        let argsObject = {};
        let args = "";
        const commandSplitted = message.content.split(" ");
        for (let i=1;i<commandSplitted.length;i++) {
            if (i > 1) {
                args += " ";
            }
            args += commandSplitted[i];
        }

        for (let i=0;i<args.length;i++) {
            if (args[i] == "-") {
                let attr = "";
                if (args[i]+args[i+1] == "--")
                    i += 2;
                else
                    i += 1;

                while (i < args.length && args[i] != " ") {
                    attr += args[i];
                    i += 1;
                }
                while (i < args.length && args[i] == " ") {
                    i += 1;
                }
                if (i < args.length && (args[i] == "'" || args[i] == '"')) {
                    let quote = args[i];
                    let value = "";
                    i += 1;
                    while (i < args.length && args[i] != quote) {
                        value += args[i];
                        i += 1;
                    }
                    argsObject[attr] = value;
                } else if (i < args.length && (args[i]+args[i+1] == "--")) {
                    this.sendErrors(message, [{
                        name: "Error syntax", value: "You cannot put an argument directly after another argument"
                    }]);
                    return false;
                } else {
                    let value = "";
                    while (i < args.length && args[i] != " ") {
                        value += args[i];
                        i += 1;
                    }
                    argsObject[attr] = value;
                }
            } else if (args[i] != " ") {
                let value = "";
                if (i < args.length && (args[i] == "'" || args[i] == '"')) {
                    let quote = args[i];
                    i += 1;
                    while (i < args.length && args[i] != quote) {
                        value += args[i];
                        i += 1;
                    }
                } else {
                    while (i < args.length && args[i] != " ") {
                        value += args[i];
                        i += 1;
                    }
                }
                let j = 0;
                while (typeof(argsObject[j]) != "undefined") {
                    j += 1;
                }
                argsObject[j] = value;
            }
        }
        return argsObject;
    }
}