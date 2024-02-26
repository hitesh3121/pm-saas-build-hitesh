export async function calculateWorkingDays(startDate, endDate) {
    const endDateUTC = new Date(endDate);
    const differenceInMs = endDateUTC.getTime() - startDate.getTime();
    const millisecondsInDay = 1000 * 60 * 60 * 24;
    const durationInDays = Math.ceil(differenceInMs / millisecondsInDay);
    return durationInDays;
}
