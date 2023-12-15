
type Environment = {
    PORT: string
    NODE_ENV: string
    USE_SSL: boolean
    DEFAULT_SOURCE: string
    ALLOW_REPUBLISHING: boolean
    SECURITY_TOKEN: string | null
    POSTGRES_DATABASE_URL: string
    MYSQL_USERNAME: string
    MYSQL_PASSWORD: string
    MYSQL_DATABASE: string
    MYSQL_HOST: string
    MYSQL_TABLE_TARGET: string
    MYSQL_PORT: string
    TABLE_NAMES: string,
    TABLE_AUTH_COLUMN_ROUTING: string,
    AUTH_TABLE: string,
    AUTH_COLUMN: string
}

const {
    PORT=80,
    NODE_ENV='development',
    USE_SSL=false,
    DEFAULT_SOURCE="API",
    ALLOW_REPUBLISHING=false,
    SECURITY_TOKEN=null,
    POSTGRES_DATABASE_URL,
    MYSQL_USERNAME,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_TABLE_TARGET="pub_events",
    TABLE_NAMES="",
    TABLE_AUTH_COLUMN_ROUTING: TABLE_AUTH_COLUMN_ROUTER="{}",
    MYSQL_PORT,
    AUTH_TABLE="auth",
    AUTH_COLUMN="token",
} = process.env as unknown as Environment;

const TABLE_AUTH_COLUMN_ROUTING: Record<string, string[] | string> = JSON.parse(TABLE_AUTH_COLUMN_ROUTER);

export {
    PORT,
    NODE_ENV,
    USE_SSL,
    DEFAULT_SOURCE,
    ALLOW_REPUBLISHING,
    SECURITY_TOKEN,
    POSTGRES_DATABASE_URL,
    MYSQL_USERNAME,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_TABLE_TARGET,
    MYSQL_PORT,
    TABLE_NAMES,
    TABLE_AUTH_COLUMN_ROUTING,
    AUTH_TABLE,
    AUTH_COLUMN,
}