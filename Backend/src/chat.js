import { randomUUID } from "node:crypto";

const MAX_ROOM_ID_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 1000;

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function emitError(socket, message) {
    socket.emit("chat:error", { message });
}

function registerChatHandlers(io, socket) {
    socket.on("chat:send", (payload = {}) => {
        if (!isRecord(payload)) {
            emitError(socket, "Invalid chat message.");
            return;
        }

        const { roomId, text } = payload;
        if (
            typeof roomId !== "string" ||
            roomId.length === 0 ||
            roomId.length > MAX_ROOM_ID_LENGTH ||
            !socket.rooms.has(roomId)
        ) {
            emitError(socket, "Join the room before sending a chat message.");
            return;
        }
        if (typeof text !== "string" || !text.trim() || text.trim().length > MAX_MESSAGE_LENGTH) {
            emitError(socket, "Messages must contain 1 to 1000 characters.");
            return;
        }

        io.to(roomId).emit("chat:message", {
            id: randomUUID(),
            roomId,
            senderId: socket.id,
            senderName: socket.data.displayName || "Guest",
            text: text.trim(),
            timestamp: new Date().toISOString(),
        });
    });
}

export default registerChatHandlers;
