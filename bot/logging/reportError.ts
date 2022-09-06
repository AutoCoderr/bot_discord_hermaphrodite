import CustomError from "./CustomError";
import logger from "./logger";

export default function reportError(e: Error|CustomError) {
    logger().error(e.message, {stack: e.stack, data: e instanceof CustomError ? e.data : null})
}