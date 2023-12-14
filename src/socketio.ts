import type { Server, Socket } from 'socket.io'
import type { SocketPayload } from './types'

import colors from 'colors/safe'
import { v4 as uuid } from 'uuid'
import { validator as SocketPayloadValidator } from './validators/socketPayload';

import {
    ALLOW_REPUBLISHING,
} from './env'

type Connection = {
    id: string,
    authToken: string,
    userId: string,
    socket: Socket
}

const connectedUsers: Record<string, Connection[]> = {}

// Do not emit anything outside of this function
export function publish(userId: string, payload: SocketPayload){
    const id = uuid();
    const connections = userId === '*'
        ? Object.values(connectedUsers).flat()
        : connectedUsers[userId]

    if(!connections){
        console.log(`No connections found for user ${userId}, skipping publish event...`);
        return;
    }
    const payloadWithId = {
        ...payload,
        id,
    }
    connections.forEach(connection => {
        try {
            connection.socket.emit(payload.type, payloadWithId);
            connection.socket.emit('changes', payloadWithId);
        } catch (error) {
            console.log(`Failed to publish payload to user ${userId} on connection ${connection.id}`, error);
        }
        console.log(`Published payload`, payloadWithId);
    });
}

async function verifyAuthToken(authToken: string){
    if(authToken === "TEST"){
        return {
            isAuthorized: true,
            user: {
                id: "-1",
                name: "Test User",
            }
        };
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
    return {
        isAuthorized: true,
        user: {
            id: "0",
            name: "Sample User",
        }
    };
}

export function initSocketio(io: Server){
    io.on('connection', async (socket) => {

        const authToken = socket.handshake.auth.token;
        const { isAuthorized, user } = await verifyAuthToken(authToken);
        
        if(!isAuthorized){
            console.log(`Failed to authorize the token: ${authToken}, closing connection...`);
            socket.emit('error', {
                code: 401,
                message: "Unauthorized",
            })
            socket.disconnect();
            return;
        }

        // Save the connection to the state
        const sessionId = uuid();
        const connection: Connection = {
            id: sessionId,
            authToken,
            userId: user.id,
            socket,
        }
        if(!connectedUsers[user.id]){
            connectedUsers[user.id] = [];
        }
        connectedUsers[user.id].push(connection);
        console.log(`User ${user.name} (id: ${user.id}) connected, session id: ${sessionId}.`);

        // Cleanup on disconnect
        socket.on('disconnect', () => {
            console.log(`User ${user.name} (id: ${user.id}) disconnected, session id: ${sessionId}.`);
            connectedUsers[user.id] = connectedUsers[user.id].filter(c => c.id !== sessionId);
            if(connectedUsers[user.id].length === 0){
                delete connectedUsers[user.id];
            }
        })

        // Allow re-publishing from the socket for testing
        if(ALLOW_REPUBLISHING){
            socket.on('event', (payload: SocketPayload) => {
                try {
                    SocketPayloadValidator.validateSync(payload);
                    publish(user.id, {
                        ...payload,
                        source: 'socketio',
                        source_type: 'socketio'
                    });
                } catch (error: any) {
                    socket.emit('error', {
                        code: 400,
                        originalBody: payload,
                        error,
                        type: error.name,
                        key: error.path,
                        message: "Invalid parameters given",
                    });
                }
            })
        }

        // Tell the client that the connection was successful
        socket.emit('connected', {
            sessionId,
            code: 200,
            message: "Successfully connected.",
        });
    });
    console.log(colors.green("[INITIALIZED]") + ": Socket.io");
}
