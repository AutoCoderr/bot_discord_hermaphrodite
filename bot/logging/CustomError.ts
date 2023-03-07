import IReportedData from "../interfaces/IReportedDatas";

export default class CustomError extends Error {
    data: null|IReportedData = null
    constructor(eOrMessage: string|Error|CustomError, data: null|IReportedData = null, stack: null|string = null) {
        super();
        if (eOrMessage instanceof CustomError || eOrMessage instanceof Error) {
            this.message = eOrMessage.message;
            this.name = eOrMessage.name;
            this.stack = eOrMessage.stack
        } else {
            this.message = eOrMessage;
        }

        if (stack !== null) {
            this.stack = stack;
        }

        this.data = (eOrMessage instanceof CustomError && eOrMessage.data !== null) ? {
            ...eOrMessage.data,
            ...(data??{})
        } : data;
    }
}