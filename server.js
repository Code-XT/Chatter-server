const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Store active users for each room
const activeUsers = new Map();
// Store active rooms
const activeRooms = new Set(["General", "Random"]); // Default rooms

io.on("connection", (socket) => {
  console.log("A user connected");

  let currentUser = null;
  let currentRoom = null;

  // Send the list of active rooms to the newly connected user
  socket.emit("active rooms", Array.from(activeRooms));

  socket.on("join", ({ name, room }) => {
    console.log(`User ${name} joined room: ${room}`);

    // Leave the previous room if any
    if (currentRoom) {
      leaveRoom(socket, currentUser, currentRoom);
    }

    currentUser = { id: socket.id, name };
    currentRoom = room;

    joinRoom(socket, currentUser, room);
  });

  socket.on("leave-room", (room) => {
    if (currentRoom === room) {
      leaveRoom(socket, currentUser, room);
      currentRoom = null;
    }
  });

  socket.on("chat message", (message) => {
    console.log(`Message: ${message.text} in room: ${message.room}`);
    // Broadcast the message to all users in the room, including the sender
    io.to(message.room).emit("chat message", message);
  });

  socket.on("create room", (roomName) => {
    if (!activeRooms.has(roomName)) {
      activeRooms.add(roomName);
      io.emit("new room", { id: roomName, name: roomName });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    if (currentRoom) {
      leaveRoom(socket, currentUser, currentRoom);
    }
  });
});

function joinRoom(socket, user, room) {
  socket.join(room);
  if (!activeUsers.has(room)) {
    activeUsers.set(room, new Set());
  }
  activeUsers.get(room).add(user);

  // Add the room to active rooms if it's not already there
  if (!activeRooms.has(room)) {
    activeRooms.add(room);
    // Emit the new room to all clients
    io.emit("new room", { id: room, name: room });
  }

  // Emit active users in the room to all users in the room
  emitActiveUsers(room);
}

function leaveRoom(socket, user, room) {
  socket.leave(room);
  if (activeUsers.has(room)) {
    activeUsers.get(room).delete(user);
    if (
      activeUsers.get(room).size === 0 &&
      room !== "General" &&
      room !== "Random"
    ) {
      activeUsers.delete(room);
      activeRooms.delete(room);
      io.emit("room closed", room);
    } else {
      emitActiveUsers(room);
    }
  }
}

function emitActiveUsers(room) {
  const users = Array.from(activeUsers.get(room) || []);
  io.to(room).emit("active users", { room, users });
}

server.listen(5000, () => {
  console.log("Server listening on *:5000");
});
