CABAEL BOARDING HOUSE - ROOM CRUD TERMINAL LOGGING

1. Open a SECOND terminal in:
   Cabael_Boarding_House_Backend_Integrated\backend-api

2. Install the backend dependencies once:
   npm install

3. Start the backend:
   npm run dev

4. Expected terminal:
   > cabael-backend@1.0.0 dev
   > nodemon server.js

   [nodemon] starting `node server.js`
   Server running on port 8080
   Room CRUD logging API: http://localhost:8080/api/rooms/action

5. Keep this terminal running while using the Admin Rooms page.

ROOMS CRUD
- Add Room -> CREATED log
- View/Edit -> UPDATED log
- Delete -> DELETED log
- Room status is printed as Available or Full.
- After a delete, the deleted room is shown with status Deleted and the remaining Available Rooms are printed with console.table().

The frontend Vite server runs on port 5173, while this Express backend runs on port 8080.
