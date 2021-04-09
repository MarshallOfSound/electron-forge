declare module 'webpack-dev-server' {
    import { Server } from 'http';
    import { Compiler } from 'webpack';
    class WebpackDevServer {
        constructor(compiler: Compiler, options?: {})
        listen(port?: number, hostname?: string): Promise<Server>
        close(): void
        logger: Console
    }
    export default WebpackDevServer
}