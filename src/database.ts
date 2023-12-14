
// Types
import type { SocketPayload } from './types';
import type { Client } from 'pg';
import type { Connection } from 'mysql'

// Utility
import colors from 'colors/safe'
import { publish } from './socketio';

// Postgres:
import PGPubsub from 'pg-pubsub';
import pg from 'pg';

// Mysql:
import mysql from 'mysql';

import {
    POSTGRES_DATABASE_URL,
    MYSQL_DATABASE,
    MYSQL_PASSWORD,
    MYSQL_USERNAME,
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_TABLE_TARGET,
} from './env'

let database: Client | Connection | null = null;
let cleanup: () => void = () => {};

export async function initPostgres(){

    database = new pg.Client({})
    await database.connect();
    // database.query(`
                    
    //     -- FUNCTION: public.dos_publish_table_changes()

    //     -- DROP FUNCTION IF EXISTS public.dos_publish_table_changes();

    //     CREATE OR REPLACE FUNCTION public.dos_publish_table_changes()
    //         RETURNS trigger
    //         LANGUAGE 'plpgsql'
    //         COST 100
    //         VOLATILE NOT LEAKPROOF
    //     AS $BODY$

    //             DECLARE
    //             row_data json;
    //             message json;

    //             BEGIN
    //                 -- Automatic variables
    //                 -- NEW
    //                 --   Data type RECORD;
    //                 --   variable holding the new database row for INSERT/UPDATE operations in row-level triggers.
    //                 --   This variable is null in statement-level triggers and for DELETE operations.
    //                 -- OLD
    //                 --   Data type RECORD;
    //                 --   variable holding the old database row for UPDATE/DELETE operations in row-level triggers.
    //                 --   This variable is null in statement-level triggers and for INSERT operations.
    //                 -- TG_OP
    //                 --   Data type text;
    //                 --   a string of INSERT, UPDATE, DELETE, or TRUNCATE telling for which operation the trigger was fired.
    //                 -- TG_TABLE_NAME
    //                 --   Data type name;
    //                 --     the name of the table that caused the trigger invocation.

    //                 -- Convert the effected table to JSON
    //                 IF(TG_OP = 'DELETE') THEN
    //                     row_data = row_to_json(OLD);
    //                 ELSE
    //                     row_data = row_to_json(NEW);
    //                 END IF;

    //                 -- Create message to be published
    //                 message = json_build_object(
    //                     'table',TG_TABLE_NAME,
    //                     'method',TG_OP,
    //                     'data',row_data);

    //                 -- Publish the message
    //                 PERFORM pg_notify('changes', message::text);

    //                 RETURN NULL;
    //             END;
                
    //     $BODY$;

    //     ALTER FUNCTION public.dos_publish_table_changes()
    //         OWNER TO admin;

    //     CREATE TRIGGER users_profile__publish_changes
    //     AFTER INSERT OR UPDATE OR DELETE
    //     ON users_profile
    //     FOR EACH ROW
    //     EXECUTE PROCEDURE dos_publish_table_changes();
    // `);
}

export async function initMysql(){
    try {
        const connection = await mysql.createConnection({
            host: MYSQL_HOST,
            port: MYSQL_PORT,
            user: MYSQL_USERNAME,
            password: MYSQL_PASSWORD,
            database: MYSQL_DATABASE,
        });
        
        await connection.connect();

        database = connection;
        cleanup = () => {
            connection.destroy();
        }

        connection.on('error', (error) => {
            console.log(colors.red("[DB ERROR]") + ':', error)
            process.exit(1)
        });

        // Grab all column names
        const tableNames = ("table1,table2,table3,table4").split(',')
        const tables = await Promise.all(
            tableNames.map(async table => 
                connection.query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = '${MYSQL_DATABASE}' 
                    AND TABLE_NAME = ${table}
                `.trim())
            )
        )

        console.log(tables)

        // function makeTrigger(tableName: string){
        //     return `
        //         CREATE TRIGGER ${tableName}_after_insert
        //         AFTER INSERT ON ${tableName}
        //         FOR EACH ROW
        //         BEGIN
        //             INSERT INTO ${MYSQL_TABLE_TARGET} (topic, type, data)
        //             VALUES ('${tableName}', 'INSERT', JSON_OBJECT(${columnDefinitions}));
        //         END;
        //     `.trim()
        // }

        // await connection.query(`
        //     CREATE TABLE IF NOT EXISTS '${MYSQL_TABLE_TARGET}' (
        //         id INT AUTO_INCREMENT PRIMARY KEY,
        //         data JSON NOT NULL,
        //         topic VARCHAR(128) NOT NULL,
        //         type VARCHAR(64) NOT NULL,
        //         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        //     );
        // `.trim());

        
    } catch (error: any) {
        console.log(colors.red("[DB ERROR]") + ':', error)
        process.exit(1)
    }
}

export async function initDatabase(){

    if(POSTGRES_DATABASE_URL){
        await initPostgres()
    }
    else if(MYSQL_DATABASE){
        await initMysql()
    }

    console.log(colors.green("[INITIALIZED]") + ": Database");
}

export function teardown(){
    cleanup?.();
}

export default {}