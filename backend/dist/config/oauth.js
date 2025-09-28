"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOAuthError = exports.handleOAuthSuccess = exports.getOAuthRedirectURL = exports.initializeOAuth = exports.oauthConfig = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const database_1 = require("./database");
const auth_1 = require("@/utils/auth");
const logger_1 = __importDefault(require("./logger"));
exports.oauthConfig = {
    google: {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
    },
    apple: {
        clientID: process.env.APPLE_CLIENT_ID || '',
        teamID: process.env.APPLE_TEAM_ID || '',
        keyID: process.env.APPLE_KEY_ID || '',
        privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH || '',
        callbackURL: process.env.APPLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/apple/callback',
    },
};
const initializeOAuth = () => {
    passport_1.default.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            const prisma = (0, database_1.getPrismaClient)();
            const user = await prisma.user.findUnique({
                where: { id },
                include: { preferences: true },
            });
            done(null, user);
        }
        catch (error) {
            done(error, null);
        }
    });
    if (exports.oauthConfig.google.clientID && exports.oauthConfig.google.clientSecret) {
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: exports.oauthConfig.google.clientID,
            clientSecret: exports.oauthConfig.google.clientSecret,
            callbackURL: exports.oauthConfig.google.callbackURL,
            scope: ['profile', 'email'],
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const prisma = (0, database_1.getPrismaClient)();
                let user = await prisma.user.findFirst({
                    where: {
                        email: profile.emails?.[0]?.value || '',
                    },
                    include: { preferences: true },
                });
                if (user) {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            firstName: profile.name?.givenName || user.firstName,
                            lastName: profile.name?.familyName || user.lastName,
                            avatar: profile.photos?.[0]?.value || user.avatar,
                            isVerified: true,
                        },
                        include: { preferences: true },
                    });
                    logger_1.default.info('Google OAuth: Existing user logged in', {
                        userId: user.id,
                        email: user.email,
                    });
                }
                else {
                    user = await prisma.user.create({
                        data: {
                            email: profile.emails?.[0]?.value || '',
                            firstName: profile.name?.givenName || '',
                            lastName: profile.name?.familyName || '',
                            avatar: profile.photos?.[0]?.value || null,
                            password: '',
                            isVerified: true,
                            preferences: {
                                create: {},
                            },
                        },
                        include: { preferences: true },
                    });
                    logger_1.default.info('Google OAuth: New user created', {
                        userId: user.id,
                        email: user.email,
                    });
                }
                return done(null, user);
            }
            catch (error) {
                logger_1.default.error('Google OAuth error', { error });
                return done(error, undefined);
            }
        }));
    }
    logger_1.default.info('OAuth strategies initialized', {
        google: !!exports.oauthConfig.google.clientID,
        apple: !!exports.oauthConfig.apple.clientID,
    });
};
exports.initializeOAuth = initializeOAuth;
const getOAuthRedirectURL = (provider, state) => {
    const baseUrl = 'http://localhost:5000';
    const redirectUrl = `${baseUrl}/api/v1/auth/${provider}`;
    if (state) {
        return `${redirectUrl}?state=${encodeURIComponent(state)}`;
    }
    return redirectUrl;
};
exports.getOAuthRedirectURL = getOAuthRedirectURL;
const handleOAuthSuccess = async (user, req, res) => {
    try {
        const tokens = (0, auth_1.generateTokens)(user);
        const prisma = (0, database_1.getPrismaClient)();
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: tokens.refreshToken },
        });
        await prisma.userSession.create({
            data: {
                userId: user.id,
                token: tokens.accessToken,
                deviceType: req.get('User-Agent') || null,
                ipAddress: req.ip || null,
                userAgent: req.get('User-Agent') || null,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/auth/oauth-success?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`;
        res.redirect(redirectUrl);
    }
    catch (error) {
        logger_1.default.error('OAuth success handler error', { error });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/oauth-error?message=${encodeURIComponent('Authentication failed')}`);
    }
};
exports.handleOAuthSuccess = handleOAuthSuccess;
const handleOAuthError = (error, req, res) => {
    logger_1.default.error('OAuth error', { error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/oauth-error?message=${encodeURIComponent('Authentication failed')}`);
};
exports.handleOAuthError = handleOAuthError;
//# sourceMappingURL=oauth.js.map