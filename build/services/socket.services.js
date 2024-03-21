import { Server as SocketIOServer } from "socket.io";
export class RegisterSocketServices {
    static io;
    constructor() { }
    static register(server) {
        this.io = new SocketIOServer(server, { cors: { origin: "*" } });
        this.io.sockets.on("connection", (socket) => {
            socket.on("join", async (userId) => {
                socket.join(userId);
                // socket.to(userId).emit("notification", {
                //   id: 4,
                //   message: "You are added in task 1",
                // });
            });
            socket.on("disconnect", () => { });
        });
    }
}
