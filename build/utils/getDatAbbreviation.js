export const getDayAbbreviation = (dayOfWeek) => {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    return days[dayOfWeek] ?? "0";
};
