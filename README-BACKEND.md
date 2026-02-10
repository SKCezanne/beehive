# Event Hive – Backend (MySQL + JSON)

Events are stored in **MySQL** and synced to **`data/events.json`** on every read/write.

## Setup

1. **MySQL**  
   Install MySQL and create a database:
   ```sql
   CREATE DATABASE beehive_events;
   ```

2. **Environment**  
   Copy `.env.example` to `.env` and set your MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=beehive_events
   ```

3. **Install and run**
   ```bash
   npm install
   npm start
   ```

4. **Use the app**  
   Open **http://localhost:3000** in the browser (do not open the HTML files directly, or API calls will fail).

- **Register an event:** http://localhost:3000/register.html → form submits to MySQL.  
- **View events:** http://localhost:3000/ (index) loads events from MySQL and shows them.  
- **JSON backup:** After each GET/POST, all events are written to `data/events.json`.
