import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { YSocketIO } from 'y-socket.io/dist/server'

const app = express()
const httpServer = createServer(app)
app.use(express.static('public'))
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

const ySocketServer = new YSocketIO(io)
ySocketServer.initialize()

const PORT = Number(process.env.PORT) || 5000

app.get("/", (req, res) => {
    res.status(200).json({
        message: "Hello World",
        success: true
    })
})
app.get("/health", (req, res) => {
    res.status(200).json({
        message: "Health check passed",
        success: true
    })
})

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`)
})
