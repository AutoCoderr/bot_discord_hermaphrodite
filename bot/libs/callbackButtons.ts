import {ButtonInteraction} from "discord.js";
import {responseType} from "../interfaces/CommandInterfaces";
import IReportedData from "../interfaces/IReportedDatas";
import CustomError from "../logging/CustomError";

const callbackButtons: {[buttonId: string]: {
    fn: (...args: any[]) => responseType|Promise<responseType>,
    buttonsToDelete: string[],
    data: IReportedData
}} = {};


export function addCallbackButton(
    buttonId: string, 
    fn: (...args: any[]) => responseType|Promise<responseType>, 
    buttonsToDelete: string[] = [],
    data: IReportedData = {}
) {
    callbackButtons[buttonId] = {
        fn, buttonsToDelete, data
    }
}
export async function findAndExecCallbackButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!callbackButtons[interaction.customId])
        return false;

    const {data} = callbackButtons[interaction.customId];
    
    try {
        const response = await callbackButtons[interaction.customId].fn();
    
        for (const buttonToDelete of callbackButtons[interaction.customId].buttonsToDelete)
            delete callbackButtons[buttonToDelete]

        delete callbackButtons[interaction.customId];

        for (const payload of response.result)
            await interaction.followUp(payload);

        return true;
    } catch (e) {
        throw new CustomError(<Error>e, {
            from: "callbackButton",
            ...data
        })
    }
}


