const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const customBadWords = ["spoiler", "leak", "confidential"];
const { generateMessage, generateLocationMessage } = require("./utils/messages");
const { addUser, removeUser, getUser, getUsersInRoom } = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

require("dotenv").config();

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

function isCustomProfane(message) {
  const lowerMessage = message.toLowerCase();
  return customBadWords.some(word => lowerMessage.includes(word));
}

io.on("connection", socket => {
  console.log("New WebSocket connection");

  socket.on("join", (options, callback) => {
    console.log("join event triggered with options:", options);
    const { error, user } = addUser({ id: socket.id, ...options });
    if (error) {
      return callback(error);
    } else {
      socket.join(user.room);

      socket.emit("message", generateMessage("Admin", "Welcome!"));
      socket.broadcast.to(user.room).emit("message", generateMessage("Admin", `${user.username} has joined!`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });

      callback();
    }
  });

  socket.on("sendMessage", (message, callback) => {
    
    const user = getUser(socket.id);
    const filter = new Filter();
    console.log(`✉️ ${user.username} is sending message: "${message}"`);
  
    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed!");
    }
  
    if (isCustomProfane(message)) {
      return callback("Your message contains restricted words!");
    }
  
    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback();
  });

  socket.on("sendLocation", (coords, callback) => {
    const user = getUser(socket.id);
    console.log(`${user.username} shared location:lat=${coords.latitude},lng=${coords.longitude}`);
    io.to(user.room).emit("locationMessage", generateLocationMessage(user.username, `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`));
    if (coords.latitude < 53 && coords.latitude > 3 && coords.longitude < 135 && coords.longitude > 73) {
      console.log("You are in China");
    } else {
      console.log("You are not in China");
    }
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    console.log(`User disconnected: ${user ? user.username : "Unknown user"}`);
    if (user) {
      io.to(user.room).emit("message", generateMessage("Admin", `${user.username} has left!`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
