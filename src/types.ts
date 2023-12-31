import type { Request, Response, NextFunction } from "express";
import type { AnySchema } from 'yup'

// Express types:
export type ExpressFunction = (req: Request, res: Response, next?: NextFunction) => void
export type Route = {
    method: "get" | "post" | "put" | "delete" | "patch"
    path: string
    handler: ExpressFunction
    validator: AnySchema
}

// Socket.io payloads & types:
export type SocketPayload = {
    table: string,
    timestamp: number
    source: string
    source_type?: 'database' | 'api' | 'socketio'
    version: number
    type: string
    data: any
}

export {
    Request,
    Response,
    NextFunction,
}