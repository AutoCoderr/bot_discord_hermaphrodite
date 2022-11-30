import CustomError from "./CustomError";
import {logError} from "./logger";

export default function reportError(e: Error|CustomError) {
    return logError(e.message, {stack: e.stack ? e.stack.split("\n") : null, data: e instanceof CustomError ? e.data : null})
}