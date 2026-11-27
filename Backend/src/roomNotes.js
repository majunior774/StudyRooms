import * as Y from "yjs";
import {
    Awareness,
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness.js";

const MAX_ROOM_ID_LENGTH = 128;
const MAX_UPDATE_BYTES = 1_000_000;
const roomNotes = new Map();

function isRoomMember(socket, roomId) {
    return typeof roomId === "string" &&
        roomId.length > 0 &&
        roomId.length <= MAX_ROOM_ID_LENGTH &&
        socket.rooms.has(roomId);
}

function readUpdate(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (Array.isArray(value) && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
        return Uint8Array.from(value);
    }
    return null;
}

function getRoomNotes(roomId, io) {
    if (roomNotes.has(roomId)) return roomNotes.get(roomId);

    const document = new Y.Doc();
    const awareness = new Awareness(document);
    awareness.on("update", ({ added, updated, removed }) => {
        const changed = [...added, ...updated, ...removed];
        if (changed.length === 0) return;
        const update = encodeAwarenessUpdate(awareness, changed);
        io.to(roomId).emit("room-notes:awareness", { roomId, update });
    });

    const entry = { document, awareness };
    roomNotes.set(roomId, entry);
    return entry;
}

function registerRoomNotesHandlers(io, socket) {
    socket.on("room-notes:join", (payload = {}) => {
        const roomId = payload?.roomId;
        if (!isRoomMember(socket, roomId)) return;

        const entry = getRoomNotes(roomId, io);
        const initialUpdate = readUpdate(payload.update);
        if (initialUpdate && initialUpdate.byteLength <= MAX_UPDATE_BYTES) {
            try {
                Y.applyUpdate(entry.document, initialUpdate, socket.id);
                if (initialUpdate.byteLength > 0) {
                    socket.to(roomId).emit("room-notes:update", { roomId, update: initialUpdate });
                }
            } catch {
                socket.emit("room-notes:error", { roomId, message: "Could not sync the shared notes." });
            }
        }

        socket.emit("room-notes:sync", {
            roomId,
            update: Y.encodeStateAsUpdate(entry.document),
        });

        const activeClientIds = [...entry.awareness.getStates().entries()]
            .filter(([, state]) => Boolean(state))
            .map(([clientId]) => clientId);
        if (activeClientIds.length) {
            socket.emit("room-notes:awareness", {
                roomId,
                update: encodeAwarenessUpdate(entry.awareness, activeClientIds),
            });
        }
    });

    socket.on("room-notes:update", (payload = {}) => {
        const { roomId } = payload;
        if (!isRoomMember(socket, roomId)) return;
        const update = readUpdate(payload.update);
        if (!update || update.byteLength === 0 || update.byteLength > MAX_UPDATE_BYTES) return;

        const entry = getRoomNotes(roomId, io);
        try {
            Y.applyUpdate(entry.document, update, socket.id);
            socket.to(roomId).emit("room-notes:update", { roomId, update });
        } catch {
            socket.emit("room-notes:error", { roomId, message: "Could not sync the shared notes." });
        }
    });

    socket.on("room-notes:awareness-update", (payload = {}) => {
        const { roomId } = payload;
        if (!isRoomMember(socket, roomId)) return;
        const update = readUpdate(payload.update);
        if (!update || update.byteLength === 0 || update.byteLength > 32_768) return;

        const entry = getRoomNotes(roomId, io);
        try {
            applyAwarenessUpdate(entry.awareness, update, socket.id);
        } catch {
            // Ignore malformed presence updates; they never affect note content.
        }
    });

    socket.on("disconnecting", () => {
        for (const roomId of socket.rooms) {
            if (roomId === socket.id) continue;
            const entry = roomNotes.get(roomId);
            if (!entry) continue;

            const ownedClientIds = [...entry.awareness.getStates().entries()]
                .filter(([, state]) => state?.user?.socketId === socket.id)
                .map(([clientId]) => clientId);
            if (ownedClientIds.length) {
                removeAwarenessStates(entry.awareness, ownedClientIds, socket.id);
            }

            if (io.sockets.adapter.rooms.get(roomId)?.size === 1) {
                entry.awareness.destroy();
                entry.document.destroy();
                roomNotes.delete(roomId);
            }
        }
    });
}

export default registerRoomNotesHandlers;
