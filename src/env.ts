
type Environment = {
    PORT: number,
    NODE_ENV: string,
    USE_SSL: boolean,
    DEFAULT_SOURCE: string,
    ALLOW_REPUBLISHING: boolean,
    SECURITY_TOKEN: string | null,
}

const {
    PORT=80,
    NODE_ENV='development',
    USE_SSL=false,
    DEFAULT_SOURCE="Unknown",
    ALLOW_REPUBLISHING=false,
    SECURITY_TOKEN=null,
} = process.env as unknown as Environment;

export {
    PORT,
    NODE_ENV,
    USE_SSL,
    DEFAULT_SOURCE,
    ALLOW_REPUBLISHING,
    SECURITY_TOKEN,
}