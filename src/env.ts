
type Environment = {
    PORT: number
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
    MYSQL_PORT: number
}

const {
    PORT=80,
    NODE_ENV='development',
    USE_SSL=false,
    DEFAULT_SOURCE="Unknown",
    ALLOW_REPUBLISHING=false,
    SECURITY_TOKEN=null,
    POSTGRES_DATABASE_URL,
    MYSQL_USERNAME,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_TABLE_TARGET="pub_events",
    MYSQL_PORT,
} = process.env as unknown as Environment;

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
}