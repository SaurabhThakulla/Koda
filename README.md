# Koda

Koda is a real-time collaborative code editor that enables multiple users to write and edit code simultaneously with minimal latency.

The system is designed to provide a consistent and conflict-free editing experience using CRDT-based synchronization.

---

## Features

* Real-time multi-user code editing
* Instant synchronization without manual refresh
* Conflict-free collaboration using Yjs (CRDT)
* Monaco Editor integration (VS Code-like experience)
* WebSocket-based communication using Socket.IO
* Scalable architecture for collaborative environments

---

## Tech Stack

### Frontend

* React
* tailwind
* @monaco-editor/react
* Yjs
* y-monaco

### Backend

* Node.js
* Express
* Socket.IO
* y-socket.io

---

## Architecture Overview

Koda uses Yjs to manage shared document state across multiple clients. Updates are propagated through a Socket.IO server, ensuring low-latency synchronization.

Flow:

1. User edits content in the editor
2. Changes are applied to a shared Yjs document
3. Updates are transmitted via Socket.IO
4. All connected clients receive and apply updates
5. The editor reflects changes in real time

---

## Project Structure

```bash
koda/
├── client/        # React frontend
├── server/        # Express + Socket.IO backend
├── README.md
```

---

## Setup and Installation

### Clone the repository

```bash
git clone https://github.com/your-username/koda.git
cd koda
```

---

### Install dependencies

#### Client

```bash
cd client
npm install
```

#### Server

```bash
cd ../server
npm install
```

---

### Run the project

#### Start backend

```bash
npm run dev
```

#### Start frontend

```bash
cd ../client
npm run dev
```

---

## Environment

* Backend: http://localhost:3000
* Frontend: http://localhost:5173

---

## Roadmap

* Authentication and user sessions
* Presence awareness (cursor tracking, user list)
* Multi-file support
* Persistent storage integration
* Access control and permissions

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

---

## License

MIT License

---

## Author

Saurav Thakulla
