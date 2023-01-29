import {MessagePayload, ModalBuilder, ModalSubmitInteraction} from "discord.js";
import {responseResultsType, responseType} from "../interfaces/CommandInterfaces";
import IReportedData from "../interfaces/IReportedDatas";
import CustomError from "../logging/CustomError";

const callbackModals: {[buttonId: string]: {
    fn: (interaction: ModalSubmitInteraction, args: {[key: string]: any}) => responseType<responseResultsType>|Promise<responseType<responseResultsType>>,
    data: IReportedData,
    createdAt: Date
}} = {};

export function addCallbackModal(
    buttonId: string, 
    fn: (interaction: ModalSubmitInteraction, args: {[key: string]: any}) => responseType<responseResultsType>|Promise<responseType<responseResultsType>>,
    data: IReportedData = {}
) {
    callbackModals[buttonId] = {
        fn, 
        data,
        createdAt: new Date()
    }
}
export async function findAndExecCallbackModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    const date = new Date();
    for (const [key,{createdAt}] of Object.entries(callbackModals)) {
        if (date.getTime() - createdAt.getTime() > 5 * 60 * 1000)
            delete callbackModals[key];
    }

    if (!callbackModals[interaction.customId])
        return false;

    const {data} = callbackModals[interaction.customId];
    
    try {
        const response = await callbackModals[interaction.customId].fn(
            interaction,
            interaction.fields.fields.reduce((acc,{value,customId}) => ({
                ...acc,
                [customId]: value
            }), {})
        );

        delete callbackModals[interaction.customId];

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


