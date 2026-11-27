import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import registerChatHandlers from "../src/chat.js";

class FakeSocket {
    constructor(id, roomIds, sockets) {
        this.id = id;
        this.rooms = new Set([id, ...roomIds]);
        this.sockets = sockets;
        this.handlers = new Map();
        this.sent = [];
    }

    on(name, handler) {
        this.handlers.set(name, handler);
    }

    emit(name, payload) {
        this.sent.push({ name, payload });
    }

    trigger(name, payload) {
        this.handlers.get(name)?.(payload);
    }

    lastSent(name) {
        return [...this.sent].reverse().find((event) => event.name === name);
    }
}

function createRoom(roomId = `chat-test-${randomUUID()}`) {
    const sockets = new Map();
    const io = {
        to(targetRoomId) {
            return {
                emit(name, payload) {
                    for (const recipient of sockets.values()) {
                        if (recipient.rooms.has(targetRoomId)) recipient.emit(name, payload);
                    }
                },
            };
        },
    };

    const createSocket = (id, rooms = [roomId], displayName = "Guest") => {
        const socket = new FakeSocket(id, rooms, sockets);
        socket.data = { displayName };
        sockets.set(id, socket);
        registerChatHandlers(io, socket);
        return socket;
    };

    return { roomId, createSocket };
}

test("relays ephemeral chat messages to current room members with server sender details", () => {
    const { roomId, createSocket } = createRoom();
    const sender = createSocket("sender", [roomId], "Study Buddy");
    const peer = createSocket("peer");

    sender.trigger("chat:send", { roomId, text: "  Hello room!  " });

    const sentMessage = sender.lastSent("chat:message").payload;
    assert.equal(peer.lastSent("chat:message").payload.id, sentMessage.id);
    assert.equal(sentMessage.senderId, "sender");
    assert.equal(sentMessage.senderName, "Study Buddy");
    assert.equal(sentMessage.text, "Hello room!");
    assert.equal(sentMessage.roomId, roomId);
    assert.equal(Number.isNaN(Date.parse(sentMessage.timestamp)), false);

    const lateJoiner = createSocket("late-joiner");
    assert.equal(lateJoiner.lastSent("chat:message"), undefined);
});

test("rejects messages from non-members and invalid message content", () => {
    const roomA = createRoom(`chat-a-${randomUUID()}`);
    const roomB = createRoom(`chat-b-${randomUUID()}`);
    const member = roomA.createSocket("member");
    const outsider = roomB.createSocket("outsider");

    outsider.trigger("chat:send", { roomId: roomA.roomId, text: "Not in this room" });
    assert.match(outsider.lastSent("chat:error").payload.message, /Join the room/);

    member.trigger("chat:send", { roomId: roomA.roomId, text: "  " });
    assert.match(member.lastSent("chat:error").payload.message, /1 to 1000/);

    member.trigger("chat:send", { roomId: roomA.roomId, text: "x".repeat(1001) });
    assert.match(member.lastSent("chat:error").payload.message, /1 to 1000/);
    assert.equal(outsider.lastSent("chat:message"), undefined);
});
