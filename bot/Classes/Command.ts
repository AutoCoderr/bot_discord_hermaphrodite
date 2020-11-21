import * as Discord from "discord.js";

export default class Command {
    static sendErrors(message, errors, help: null|Function = null){
        const commandName = message.content.split(" ")[0];
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Error in '+commandName)
            //.setAuthor('Forbid', 'https://image.noelshack.com/fichiers/2020/34/7/1598188353-icons8-jason-voorhees-500.png')
            .setDescription("There is some errors in your command")
            //.setThumbnail('https://image.noelshack.com/fichiers/2020/34/7/1598188353-icons8-jason-voorhees-500.png')
            .setTimestamp()

        for (let error of errors) {
            Embed.addFields(
                error,
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
            if (i < args.length-1 && args[i]+args[i+1] == "--") {
                let attr = "";
                i += 2;
                while (i < args.length && args[i] != " ") {
                    attr += args[i];
                    i += 1;
                }
                while (i < args.length && args[i] == " ") {
                    i += 1;
                }
                let values: Array<string> = [];
                while (i < args.length && args[i] != "-") {
                    if (i < args.length && (args[i] == "'" || args[i] == '"')) {
                        let quote = args[i];
                        let value = "";
                        i += 1;
                        while (i < args.length && args[i] != quote) {
                            value += args[i];
                            i += 1;
                        }
                        values.push(value);
                    } else if (args[i] != " ") {
                        let value = "";
                        while (i < args.length && args[i] != " ") {
                            value += args[i];
                            i += 1;
                        }
                        values.push(value);
                    }
                    i += 1;
                }
                if (values.length == 0) {
                    this.sendErrors(message, [{
                        name: "Error syntax", value: "You cannot put an argument directly after another argument"
                    }]);
                    return false;
                }
                argsObject[attr] = values.length == 1 ? values[0] : values;
                i -=1;
            }
        }
        return argsObject;
    }
}