# Cabael Boarding House

The Admin sidebar now keeps room management directly under **Rooms**. There is no separate Admin CRUD/Backend page.

## Admin Rooms

From **Admin -> Rooms**, the administrator can:

- Add a room
- View/Edit a room
- Delete a room with confirmation
- Change room lights
- Filter by room number, type, and status
- See `AVAILABLE` / `FULL` room status on each room card

Room Add/Edit/Delete actions are also sent to the separate Express backend so they appear in the backend terminal.

## Run the frontend

```bash
npm install
npm run dev
```

Vite runs on port **5173**.

## Run the room CRUD backend

Open a second terminal:

```bash
cd backend-api
npm install
npm run dev
```

Express runs on port **8080**.

When you add, edit, or delete a room, the backend terminal prints the room action and `console.table()` output showing the room status and the currently available rooms.
