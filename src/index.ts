// Navarrotech 2023
console.log('')

// Default imports
import express from "express";
import helmet from "helmet";
import http from "http";
import https from "https";
import colors from 'colors/safe'
import { Server as SocketioServer } from "socket.io";

// Handlers
import routes from './routes'
import { initSocketio } from './socketio'
import { initDatabase } from "./database";
import { version } from "./version";

// Environment Variables
import {
    PORT,
    NODE_ENV,
    USE_SSL,
} from './env';

// Instance Declarations
const app = express();
const devServer = http.createServer(app);
const sslServer = https.createServer(app);

const server = USE_SSL === false
    ? sslServer
    : devServer;

const socketio = new SocketioServer(server);

// Middleware:
app.use(
    helmet({
        contentSecurityPolicy: false
    })
)

// Node.js error reporting
app.on('error', (error: any) => {
    console.log(colors.red("[ERROR]") + ':', error)
    process.exit(1)
});
process.on('uncaughtException', async function (error: any) {
  console.log(colors.red("[ERROR]") + ':', error)
  process.exit(1)
});

// Socket.io
initSocketio(socketio)

// Routes
app.all('/ping', (request, response) => response.status(200).send('pong'))

routes.forEach(route => {
    app[route.method](route.path, (request, response) => {
        const { body } = request;

        try {
            route.validator.validateSync(body);

            route.handler(
                request,
                response
            );

        } catch(error: any) {
            response
                .status(400)
                .json({
                    code: 400,
                    error,
                    type: error.name,
                    key: error.path,
                    message: error.message,
                });
        }
    })
    console.log(
        colors.green("[ROUTE READY]") + `: ${route.method.toUpperCase()} - ${route.path}`
    )
})

app.all('*', (request: any, response: any) =>
    response.status(404).send({
        code: 404,
        message: "Route not found"
    })
);

Promise.all([
  initDatabase(),
]).then(() => {

  // Start the server
  server.listen(PORT, () => 
      console.log(
        colors.green("[INITIALIZED]") + `: Server\n\n`
        + `Esink micro-service running\n`
        + `Version: ${colors.blue(version)}\n`
        + `Port: ${colors.blue(String(PORT))}\n`
        + `Environment: ${colors.blue(NODE_ENV)}\n`
        + `SSL enabled: ${colors.blue(String(!!USE_SSL))}\n\n`
        + `Created by ${colors.red('Navarrotech')} 2023`
    )
  )
})
