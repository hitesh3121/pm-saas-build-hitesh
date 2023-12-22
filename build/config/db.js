import { PrismaClient } from "@prisma/client";
const rootPrismaClient = generatePrismaClient();
const prismaClients = {
    root: rootPrismaClient,
};
function generatePrismaClient(datasourceUrl) {
    let prismaClientParams = [];
    if (typeof datasourceUrl === "string") {
        prismaClientParams = [
            {
                datasourceUrl,
            },
        ];
    }
    const client = new PrismaClient(...prismaClientParams).$extends({
        result: {
            task: {
                endDate: {
                    needs: { startDate: true, duration: true },
                    compute(task) {
                        const { startDate, duration } = task;
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + duration);
                        return endDate;
                    },
                },
                flag: {
                    needs: { milestoneIndicator: true },
                    compute(task) {
                        let { milestoneIndicator, duration, completionPecentage } = task;
                        //TODO: Need to change logic here
                        const plannedProgress = duration / duration;
                        if (!completionPecentage) {
                            completionPecentage = "100";
                        }
                        const tpi = parseInt(completionPecentage) / plannedProgress;
                        if (milestoneIndicator) {
                            return tpi < 1 ? "Red" : "Green";
                        }
                        else {
                            if (tpi < 0.8) {
                                return "Red";
                            }
                            else if (tpi >= 0.8 && tpi < 0.95) {
                                return "Orange";
                            }
                            else {
                                return "Green";
                            }
                        }
                    },
                },
            },
        },
    });
    return client;
}
export async function getClientByTenantId(tenantId) {
    if (!tenantId) {
        return prismaClients.root;
    }
    const findTenant = await prismaClients.root?.tenant.findUnique({
        where: { tenantId: tenantId },
    });
    if (!findTenant) {
        return prismaClients.root;
    }
    prismaClients[tenantId] = generatePrismaClient(findTenant.connectionString);
    return prismaClients[tenantId];
}
