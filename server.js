const ws = require("ws");
const port = 3000;
const server = new ws.Server({ port });

const userData = [
  { days: 80, warranty: 24, payment: 30 },
  { days: 90, warranty: 24, payment: 100 },
  { days: 75, warranty: 22, payment: 60 },
  { days: 120, warranty: 36, payment: 50 },
];

let users = [];
const allowedList = ["/user1", "/user2", "/user3", "/user4"];
let currBid = 0;
let currentUser = 0;
let auctionActive = false;
const turnTime = 30 * 1000;

server.on("connection", (ws, req) => {
  const role = req.url;
  console.log("connected", role);

  if (!allowedList.includes(role) && !role.includes("admin")) {
    ws.send("У вас нету права учавтсвоать в аукционе");
    return;
  }

  if (!role.includes("admin") && !auctionActive) {
    ws.send("Сейчас нету аукциона");
    return;
  }

  const user = {
    socket: ws,
    id: users.length,
    bid: currBid,
    role,
    userData: userData[users.length],
  };
  users.push(user);
  updateAllUsers();

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    console.log(data);

    switch (data.type) {
      case "started":
        if (!auctionActive) {
          //
          startAuction();
          updateAllUsers();
        }
        break;

      case "ended":
        if (auctionActive) {
          endAuction();
        }

        break;

      case "bid":
        if (auctionActive && ws.id === users[currentUser].id) {
          currBid = data.price;
          updateAll({ type: "bidUpdated", price: currBid });
          nextTurn();
        }
        break;

      default:
        ws.send("err wrong datatype");
        break;
    }
  });

  ws.on("close", () => {
    users = users.filter((participant) => participant.socket !== ws);
    if (users.length === 0) {
      auctionActive = false;
      currBid = 0;
      currentUser = 0;
    } else {
      updateAllUsers();
    }
  });
});

function updateAll(data) {
  users.forEach((user) => {
    if (user.socket.readyState === ws.OPEN) {
      user.socket.send(JSON.stringify(data));
    }
  });
}

function updateAllUsers() {
  updateAll({
    type: "usersUpdated",
    users: users.map((user) => ({ id: user.id, role: user.role, userData:user.userData })),
  });
}

function startAuction() {
  auctionActive = true;
  updateAll({ type: "started", users: users, duration: 15 * 60000 });
  //setTimeout(endAuction, 15 * 60000);
  //nextTurn();
}

function endAuction() {
  auctionActive = false;
  updateAll({ type: "ended", finalPrice: currBid });
  currBid = 0;
}

function nextTurn() {
  if (!auctionActive) return;

  currentUser = (currentUser + 1) % users.length;
  const currentParticipant = users[currentUser];

  updateAll({
    type: "turn",
    participant: currentParticipant.id,
    turnDuration: turnTime,
  });

  setTimeout(nextTurn, turnTime);
}

console.log(`live on ws://localhost:${port}`);
