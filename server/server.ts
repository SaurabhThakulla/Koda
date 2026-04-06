// @ts-ignore
import express from 'express'
import {createServer} from 'http'
import { Server } from 'socket.io'
import {YSOCKETIO} from "y-socket.io/dist/server"

const app = express()
const server = createServer(app)
const io = new Server(server)