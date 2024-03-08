export const isHoliday = (date, holidays) => {
    const holidayDates = holidays.map((holiday) => new Date(holiday.holidayStartDate).setUTCHours(0, 0, 0, 0));
    const dateToCheck = date.setUTCHours(0, 0, 0, 0);
    return holidayDates.includes(dateToCheck);
};
