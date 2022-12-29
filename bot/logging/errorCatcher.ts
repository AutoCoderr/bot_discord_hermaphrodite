import IReportedData from "../interfaces/IReportedDatas"
import CustomError from "./CustomError"
import reportError from "./reportError"

export default function errorCatcher(
    fn: ((...args: any[]) => void|Promise<void>), 
    onFailed: null|((e: CustomError) => void|Promise<void>) = null, 
    reportedData: IReportedData = {}
) {
    return async (...args: any[]) => {
        try {
            await fn(args)
        } catch(e) {
            const customError = new CustomError(<Error>e, reportedData);
            if(onFailed)
                onFailed(customError)
            reportError(customError);
        }
    }
}