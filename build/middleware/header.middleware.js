export const defualtHeaderMiddleware = (req, res, next) => {
    const tenantIdValue = req.headers["tenant-id"];
    const organisationIdvalue = req.headers["organisation-id"];
    req.tenantId = tenantIdValue ?? "root";
    if (organisationIdvalue)
        req.organisationId = organisationIdvalue;
    next();
};
