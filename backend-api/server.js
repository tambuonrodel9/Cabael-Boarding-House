const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

const products = [];
let rooms = [
  {
    id: 1,
    number: "Room 101",
    gender: "Male",
    capacity: 4,
    occupants: 2,
    rent: 2500
  },
  {
    id: 2,
    number: "Room 102",
    gender: "Female",
    capacity: 4,
    occupants: 3,
    rent: 2500
  },
  {
    id: 3,
    number: "Room 103",
    gender: "Male",
    capacity: 2,
    occupants: 0,
    rent: 2000
  },
  {
    id: 4,
    number: "Room 104",
    gender: "Female",
    capacity: 2,
    occupants: 2,
    rent: 2000
  }
];

const roomStatus = (room) => {
  const occupants = Array.isArray(room?.tenants) ? room.tenants.length : Number(room?.occupants || 0);
  const capacity = Number(room?.capacity || 0);
  return occupants >= capacity ? 'Full' : 'Available';
};

const cleanRoom = (room) => ({
  id: room?.id,
  room: room?.number ?? room?.room ?? '',
  type: room?.gender ?? room?.type ?? '',
  capacity: Number(room?.capacity || 0),
  occupants: Array.isArray(room?.tenants) ? room.tenants.length : Number(room?.occupants || 0),
  rent: Number(room?.rent || 0),
  status: roomStatus(room)
});

function printRoomStatus(action, room = null) {
  const normalizedAction = String(action || '').toUpperCase();
  console.log(`\n========== ROOM ${normalizedAction} ==========`);

  if (normalizedAction === 'DELETED') {
    // After a delete, show ONLY the rooms that are still available.
    const availableRooms = rooms.map(cleanRoom).filter(r => r.status === 'Available');
    console.log('AVAILABLE ROOMS AFTER DELETE');
    console.table(availableRooms);
  } else if (room) {
    // For a single-room action, show ONLY the affected room.
    console.table([cleanRoom(room)]);
  }

  console.log('===================================\n');
}

app.get('/api/product', (req, res) => {
  res.json(products);
});

app.post('/api/product', (req, res) => {
  const { name, price } = req.body;
  const product = { id: Date.now(), name, price };
  products.push(product);
  console.log(product);
  res.status(201).json(product);
});

app.post('/api/rooms/action', (req, res) => {
  const { action, room, rooms: incomingRooms } = req.body || {};
  if (Array.isArray(incomingRooms)) rooms = incomingRooms;

  const normalizedAction = String(action || 'UPDATED').toUpperCase();
  if (normalizedAction === 'DELETED') {
    console.log(`[ROOM] DELETED | Room ${room?.number || room?.room || room?.id}`);
    printRoomStatus('DELETED', room);
  } else if (normalizedAction === 'CREATED') {
    console.log(`[ROOM] CREATED | Room ${room?.number || room?.room || room?.id}`);
    printRoomStatus('CREATED', room);
  } else if (normalizedAction === 'UPDATED') {
    console.log(`[ROOM] UPDATED | Room ${room?.number || room?.room || room?.id}`);
    printRoomStatus('UPDATED', room);
  } else {
    console.log(`[ROOM] ${normalizedAction} | Room ${room?.number || room?.room || room?.id}`);
    printRoomStatus(normalizedAction, room);
  }

  res.json({ ok: true, action: normalizedAction, room: room || null, rooms });
});

app.get('/api/rooms', (req, res) => {
  res.json(rooms.map(cleanRoom));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});