export function extractEmoteName(emoteName) {
    return emoteName.split(":")[1]
}

export function addMissingZero(number, n = 2) {
    number = number.toString();
    while (number.length < n) {
        number = "0"+number;
    }
    return number;
}