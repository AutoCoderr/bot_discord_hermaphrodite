import {existingCommands} from "./Classes/CommandsDescription";
import TicketCommunication, {ITicketCommunication} from "./Models/TicketCommunication";
import TicketConfig , {ITicketConfig} from "./Models/TicketConfig";

export default function init(bot) {
    setTimeout(async () => {
        console.log("Detect stored notifyOnReacts in the database and apply them")
        existingCommands.notifyOnReact.commandClass.applyNotifyOnReactAtStarting(bot);
    }, 5000);
}
