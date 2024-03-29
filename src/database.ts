
// Types
import type { SocketPayload } from './types';
import type { Client } from 'pg';
import type { Connection } from 'mysql';

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
    TABLE_NAMES,
    TABLE_AUTH_COLUMN_ROUTING,
    MYSQL_TABLE_TARGET,
    FILTERS,
} from './env'

const tableNames = (TABLE_NAMES).split(',').map(s => s.trim())

let filters: Record<string, string[]>; // Record of table name, and array of column names to blacklist
let cleanup: () => void = async () => {};
let MySQLClient: Connection;
let PgClient: Client;

function publishWithAuthCheck(authRouting: string | string[], payload: SocketPayload){
    // Publish to all users:
    if(authRouting === '*'){
        return publish('*', payload)
    }
    // Publish to a specific user id:
    if(typeof authRouting === 'string'){
        return publish(payload.data[authRouting], payload)
    }
    // Publish to multiple in id set:
    if(Array.isArray(authRouting)){
        return authRouting.forEach((column) => {
            publish(
                payload.data[column],
                payload
            )
        })
    }
}

export async function initPostgres(){
    const connection = new pg.Client({});
    await connection.connect();

    console.log("[CONNECTED] : Postgres connected.")

    // Setup triggers
    await connection.query(`
        CREATE OR REPLACE FUNCTION public.publish_changes()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 100
            VOLATILE NOT LEAKPROOF
        AS $BODY$

            DECLARE
            row_data json;
            message json;

            BEGIN
                IF(TG_OP = 'DELETE') THEN
                    row_data = row_to_json(OLD);
                ELSE
                    row_data = row_to_json(NEW);
                END IF;

                message = json_build_object(
                    'data', row_data,
                    'method', TG_OP,
                    'table', TG_TABLE_NAME
                );

                PERFORM pg_notify('changes', message::text);

                RETURN NULL;
            END;

        $BODY$;
    `)

    function makeTrigger(tableName: string){
        return `
            -- Drop the old trigger first:
            DROP TRIGGER IF EXISTS ${tableName}__publish_changes ON ${tableName};

            -- Create a new "on create" trigger:
            CREATE TRIGGER ${tableName}__publish_changes
            AFTER INSERT OR UPDATE OR DELETE
            ON ${tableName}
            FOR EACH ROW
            EXECUTE PROCEDURE publish_changes();
        `
    }

    if (!TABLE_NAMES) {
        console.log("No table names provided")
        return;
    }

    // Generate triggers:
    await Promise.all(
        tableNames.map(
            (tableName) => connection.query(makeTrigger(tableName))
        )
    )

    type ChangesPayload = {
        table: string,
        method: 'INSERT' | 'UPDATE' | 'DELETE',
        data: any,
    }
    const pubsub = new PGPubsub(POSTGRES_DATABASE_URL);
    await pubsub.addChannel('changes', (data: ChangesPayload) => {
        const authRouting: string | string[] = TABLE_AUTH_COLUMN_ROUTING[data.table]

        const payload: SocketPayload = {
            table: data.table,
            type: data.method.toLowerCase(),
            data: data.data,
            source: 'postgres',
            source_type: 'database',
            timestamp: Date.now(),
            version: 1,
        }

        publishWithAuthCheck(authRouting, payload)
    });
    
    PgClient = connection;
}

export async function initMysql(){
    try {
        const connection = await mysql.createConnection({
            host: MYSQL_HOST,
            port: parseInt(MYSQL_PORT),
            user: MYSQL_USERNAME,
            password: MYSQL_PASSWORD,
            database: MYSQL_DATABASE,
        });
        
        try {
            await connection.connect();
        } catch (error: any){
            console.log(error);
            return;
        }

        MySQLClient = connection;

        console.log(colors.green("[ CONNECTED ]: ") + ': Connected to MySQL database');

        connection.on('error', (error) => {
            console.log(colors.red("[DB ERROR]") + ':', error)
        });

        const queryAsync = (query: string): Promise<any[]> => {
            return new Promise((resolve, reject) => {
                connection.query(query, (error, results) => {
                    if(error){
                        console.log(colors.red("[DB ERROR]") + ':', error)
                        return resolve([])
                    }
                    else {
                        // For some reason, results are a class object varying of what type of query is run
                        // Instead, we want a plain (flat) JSON object:
                        const data = JSON.parse(
                            JSON.stringify(results)
                        )
                        // By default, the table returns an array of objects but the data column is stringified JSON
                        if(Array.isArray(data) && data?.[0]?.data){
                            return resolve(
                                data.map(
                                    (item: any) => ({
                                        ...item,
                                        data: JSON.parse(item.data)
                                    })
                                )
                            )
                        }
                        resolve(data as any[])
                    }
                })
            })
        }

        cleanup = async () => {
            await connection.end();
        }

        // Grab all column names
        const tables: any[] = await Promise.all(
            tableNames.map((table) => 
                queryAsync(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = '${MYSQL_DATABASE}' 
                    AND TABLE_NAME = '${table}';
                `.trim())
            )
        )

        const tableNamesByTable: Record<string, string[]> = tables.reduce((prev, next, index) => {
            const arr = next.map((i: any) => i.COLUMN_NAME)
            prev[tableNames[index]] = arr
            return prev;
        }, {})

        const makeTrigger = (tableName: string) => {
            const tableNames = tableNamesByTable[tableName]
    
            return `
                -- Drop the old trigger first:
                DROP TRIGGER IF EXISTS ${MYSQL_DATABASE}.${tableName}_after_insert;

                -- Create a new "on create" trigger:
                CREATE TRIGGER ${tableName}_after_insert
                AFTER INSERT ON ${tableName}
                FOR EACH ROW
                BEGIN
                    INSERT INTO ${MYSQL_TABLE_TARGET} (table_name, type, data)
                    VALUES ('${tableName}', 'INSERT', JSON_OBJECT(${
                        tableNames.map(
                            (columnName) => `'${columnName}', NEW.${columnName}`
                        ).join(', ')
                    }));
                END;

                -- Drop the old trigger first:
                DROP TRIGGER IF EXISTS ${MYSQL_DATABASE}.${tableName}_after_update;

                -- Create a new "on update" trigger:
                CREATE TRIGGER ${tableName}_after_update
                AFTER UPDATE ON ${tableName}
                FOR EACH ROW
                BEGIN
                    UPDATE INTO ${MYSQL_TABLE_TARGET} (table_name, type, data)
                    VALUES ('${tableName}', 'INSERT', JSON_OBJECT(${
                        tableNames.map(
                            (columnName) => `'${columnName}', NEW.${columnName}`
                        ).join(', ')
                    }));
                END;

                -- Drop the old trigger first:
                DROP TRIGGER IF EXISTS ${MYSQL_DATABASE}.${tableName}_after_delete;

                -- Create a new "on delete" trigger:
                CREATE TRIGGER ${tableName}_after_delete
                AFTER DELETE ON ${tableName}
                FOR EACH ROW
                BEGIN
                    DELETE INTO ${MYSQL_TABLE_TARGET} (table_name, type, data)
                    VALUES ('${tableName}', 'INSERT', JSON_OBJECT(${
                        tableNames.map(
                            (columnName) => `'${columnName}', OLD.${columnName}`
                        ).join(', ')
                    }));
                END;
            `.trim()
        }

        // Recreate the pubsub table:
        await queryAsync(`DROP TABLE IF EXISTS \`${MYSQL_TABLE_TARGET}\`;`)

        if(!TABLE_NAMES){
            return;
        }

        await queryAsync(`
            CREATE TABLE \`${MYSQL_TABLE_TARGET}\` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data JSON NOT NULL,
                table_name VARCHAR(128) NOT NULL,
                type VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `.trim());

        // Generate triggers:
        await Promise.all(
            tableNames.map(
                (tableName) => makeTrigger(tableName)
            )
        )

        let isRunning = false;
        setInterval(async () => {
            // Prevent overloading, only run one at a time:
            if(isRunning){
                return;
            }

            isRunning = true;

            // Has anything changed?
            const results: any[] = await queryAsync(`
                SELECT * FROM ${MYSQL_TABLE_TARGET}
            `)

            if(results.length){

                // Publish each topic
                results.forEach(result => {
                    console.log(result)
                    const authRouting: string | string[] = TABLE_AUTH_COLUMN_ROUTING[result.table_name]

                    const payload: SocketPayload = {
                        table: result.table_name,
                        type: result.type.toLowerCase(),
                        data: result.data,
                        source: MYSQL_DATABASE,
                        source_type: 'database',
                        timestamp: Date.now(),
                        version: 1,
                    }
                    
                    publishWithAuthCheck(authRouting, payload)
                })

                // Delete the published rows
                const ids = results.map((result) => result.id)
                await queryAsync(`
                    DELETE FROM ${MYSQL_TABLE_TARGET}
                    WHERE id IN (${ids.join(',')})
                `)
            }

            isRunning = false;
        }, 250)
    
    } catch (error: any) {
        console.log(colors.red("[DB ERROR]") + ':', error)
    }
}

export async function initDatabase(){
    let rawFilterData = (FILTERS + "").trim();
    if(rawFilterData.endsWith(',')){
        rawFilterData = rawFilterData.slice(0, -1);
    }
    filters = rawFilterData.split(',').reduce((prev, next) => {
        if(!next){
            return prev;
        }
        let [ table, column ] = next.split('.');
        table = table.trim();
        column = column.trim();
        if(!prev[table]){
            prev[table] = [column];
        } else {
            prev[table].push(column);
        }
        return prev;
    }, {} as Record<string, string[]>)

    if(MYSQL_DATABASE){
        await initMysql()
    } else if(POSTGRES_DATABASE_URL){
        await initPostgres()
    }

    console.log(colors.green("[INITIALIZED]") + ": Database");
}

export function filterColumns<T extends object = any>(table: string, data: T): T{
    if(!filters[table]){
        return data;
    }

    for(const column of filters[table]){
        // @ts-ignore
        delete data[column];
    }

    return data;
}

export async function queryDatabaseAsync(query: string, values: any[]): Promise<any[]>{
    if(MySQLClient){
        return new Promise((resolve, reject) => {
            MySQLClient.query(query, values, (error, results) => {
                if(error){
                    console.log(colors.red("[DB ERROR]") + ':', error)
                    return resolve([])
                }
                else {
                    // For some reason, results are a class object varying of what type of query is run
                    // Instead, we want a plain (flat) JSON object:
                    const data = JSON.parse(
                        JSON.stringify(results)
                    )
                    resolve(data as any[])
                }
            })
        }) as unknown as Promise<any[]>
    }
    if(PgClient){
        // Replace all ? with $1 $2 $3...
        let index = 0;
        query = query.replace(/\?/g, () => `$${++index}`)

        const result = await PgClient
            .query(query, values)
            .catch((error) => {
                console.log(colors.red("[DB ERROR]") + ':', error)
                return {
                    rows: []
                }
            })

        return result.rows
    }
    console.log(colors.red("[DB ERROR]") + ': No database connection found, returning empty query')
    return Promise.resolve([])
}

export async function teardown(){
    await cleanup?.();
}

export default {}