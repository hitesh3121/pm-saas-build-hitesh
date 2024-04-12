import { Server as SocketIOServer } from "socket.io";
export class RegisterSocketServices {
    static io;
    constructor() { }
    static register(server) {
        this.io = new SocketIOServer(server, { cors: { origin: "*" } });
        this.io.sockets.on("connection", (socket) => {
            socket.on("join", async (userId) => {
                socket.join(userId);
            });
            socket.on("disconnect", () => { });
        });
    }
}
