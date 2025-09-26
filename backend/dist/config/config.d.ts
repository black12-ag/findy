export declare const config: {
    readonly server: {
        readonly port: any;
        readonly apiVersion: any;
        readonly nodeEnv: any;
        readonly isDevelopment: boolean;
        readonly isProduction: boolean;
        readonly isTest: boolean;
    };
    readonly database: {
        readonly url: any;
        readonly redis: any;
    };
    readonly auth: {
        readonly jwtSecret: any;
        readonly jwtExpiresIn: any;
        readonly refreshTokenSecret: any;
        readonly refreshTokenExpiresIn: any;
        readonly bcryptRounds: any;
    };
    readonly apis: {
        readonly googleMaps: any;
        readonly mapbox: any;
        readonly openWeather: any;
        readonly firebase: any;
    };
    readonly email: {
        readonly host: any;
        readonly port: any;
        readonly user: any;
        readonly pass: any;
    };
    readonly upload: {
        readonly maxFileSize: any;
        readonly uploadPath: any;
    };
    readonly security: {
        readonly corsOrigin: any;
        readonly rateLimitWindowMs: any;
        readonly rateLimitMaxRequests: any;
    };
    readonly logging: {
        readonly level: any;
    };
    readonly features: {
        readonly enableDocs: any;
    };
};
export default config;
//# sourceMappingURL=config.d.ts.map