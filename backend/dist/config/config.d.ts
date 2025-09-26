export declare const config: {
    readonly server: {
        readonly port: number;
        readonly apiVersion: string;
        readonly nodeEnv: "development" | "production" | "test";
        readonly isDevelopment: boolean;
        readonly isProduction: boolean;
        readonly isTest: boolean;
    };
    readonly database: {
        readonly url: string;
        readonly redis: string;
    };
    readonly auth: {
        readonly jwtSecret: string;
        readonly jwtExpiresIn: string;
        readonly refreshTokenSecret: string;
        readonly refreshTokenExpiresIn: string;
        readonly bcryptRounds: number;
    };
    readonly apis: {
        readonly googleMaps: string | undefined;
        readonly mapbox: string | undefined;
        readonly openWeather: string | undefined;
        readonly firebase: string | undefined;
    };
    readonly email: {
        readonly host: string | undefined;
        readonly port: number;
        readonly user: string | undefined;
        readonly pass: string | undefined;
    };
    readonly upload: {
        readonly maxFileSize: number;
        readonly uploadPath: string;
    };
    readonly security: {
        readonly corsOrigin: string;
        readonly rateLimitWindowMs: number;
        readonly rateLimitMaxRequests: number;
    };
    readonly cors: {
        readonly allowedOrigins: readonly [string, "http://localhost:3000"];
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly max: number;
    };
    readonly node: {
        readonly env: "development" | "production" | "test";
    };
    readonly logging: {
        readonly level: string;
    };
    readonly features: {
        readonly enableDocs: boolean;
    };
};
export default config;
//# sourceMappingURL=config.d.ts.map