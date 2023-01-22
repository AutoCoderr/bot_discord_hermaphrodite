import {ButtonInteraction, MessagePayload, ModalBuilder} from "discord.js";
import {responseType} from "../interfaces/CommandInterfaces";
import IReportedData from "../interfaces/IReportedDatas";
import CustomError from "../logging/CustomError";

const callbackButtons: {[buttonId: string]: {
    fn: (...args: any[]) => responseType|Promise<responseType>,
    buttonsToDelete: string[],
    data: IReportedData,
    createdAt: Date
}} = {};

export function addCallbackButton(
    buttonId: string, 
    fn: (...args: any[]) => responseType|Promise<responseType>, 
    buttonsToDelete: string[] = [],
    data: IReportedData = {}
) {
    callbackButtons[buttonId] = {
        fn, 
        buttonsToDelete, 
        data,
        createdAt: new Date()
    }
}
export async function findAndExecCallbackButton(interaction: ButtonInteraction): Promise<boolean> {
    const date = new Date();
    for (const [key,{createdAt}] of Object.entries(callbackButtons)) {
        if (date.getTime() - createdAt.getTime() > 5 * 60 * 1000)
            delete callbackButtons[key];
    }

    if (!callbackButtons[interaction.customId])
        return false;

    const {data} = callbackButtons[interaction.customId];
    
    try {
        const response = await callbackButtons[interaction.customId].fn();
    
        for (const buttonToDelete of callbackButtons[interaction.customId].buttonsToDelete)
            delete callbackButtons[buttonToDelete]

        delete callbackButtons[interaction.customId];

        if (response.result instanceof ModalBuilder) {
            return interaction.showModal(response.result).then(() => true);
        }

        await interaction.deferReply({ephemeral: true});
        
        for (const payload of response.result)
            await interaction.followUp(payload instanceof MessagePayload ? payload : {
                ephemeral: true,
                ...(
                    typeof(payload) === "string" ?
                        {content: payload} :
                        payload
                )
            });

        return true;
    } catch (e) {
        throw new CustomError(<Error>e, {
            from: "callbackButton",
            ...data
        })
    }
}


