import {existingCommands} from "./Classes/CommandsDescription";
import {getExistingCommands} from "./Classes/CommandsDescription";

export default function init(bot) {
    setTimeout(async () => {
        getExistingCommands().then(() => {
            console.log("Detect stored notifyOnReacts in the database and apply them")
            //@ts-ignore
            existingCommands.NotifyOnReact.applyNotifyOnReactAtStarting(bot);
            //@ts-ignore
            existingCommands.Monitor.initAllEventListeners();
            //@ts-ignore
            existingCommands.ConfigTicket.initListeningAllMessages();
        })
    }, 5000);
}
