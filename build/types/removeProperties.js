export const removeProperties = (obj, keys) => {
    const copy = { ...obj };
    keys.forEach((key) => {
        delete copy[key];
    });
    return copy;
};
