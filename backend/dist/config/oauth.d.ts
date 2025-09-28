export declare const oauthConfig: {
    google: {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
    };
    apple: {
        clientID: string;
        teamID: string;
        keyID: string;
        privateKeyPath: string;
        callbackURL: string;
    };
};
export declare const initializeOAuth: () => void;
export declare const getOAuthRedirectURL: (provider: "google" | "apple", state?: string) => string;
export declare const handleOAuthSuccess: (user: any, req: any, res: any) => Promise<void>;
export declare const handleOAuthError: (error: any, req: any, res: any) => void;
//# sourceMappingURL=oauth.d.ts.map