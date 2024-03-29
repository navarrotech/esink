import type { Request, Response, Route } from "../types";
import type { SocketPayload } from "../types";

import colors from "colors/safe";
import { publish } from "../socketio";
import { routeValidator } from "../validators/socketPayload";

import {
    SECURITY_TOKEN,
} from '../env'

type Body = {
    userId: string,
    securityToken: string,
} & SocketPayload

if(!SECURITY_TOKEN){
    console.error(colors.red("[ENV]: SECURITY_TOKEN environment variable is not set! Publishing API is disabled.\n"));
}

function handler(req: Request, response: Response){
    if(!SECURITY_TOKEN){
        return response.send({
            code: 403,
            message: "Publishing API is disabled, because SECURITY_TOKEN environment variable is not set!",
        })
    }

    const {
        data,
        type,
        source = 'api',
        version = 1,
        timestamp = Date.now(),
        userId,
        table,
        securityToken,
    } = req.body as Body;

    if(securityToken !== SECURITY_TOKEN){
        return response
            .status(401)
            .send({
                code: 401,
                message: "Unauthorized, invalid security token",
            });
    }

    try {
        const results = publish(
            userId,
            {
                data,
                type,
                source,
                version,
                timestamp,
                source_type: 'api',
                table
            }
        );

        response
            .status(200)
            .send({
                code: 200,
                ...results,
                message: "Message queued for publishing",
            });

    } catch(error: any) {
        response
            .status(500)
            .send({
                code: 500,
                message: "Internal server error",
                error
            });
    }
}

export default {
    method: "post",
    path: "/publish",
    handler,
    validator: routeValidator,
} as Route;
