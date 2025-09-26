import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getPrismaClient } from './database';
import { generateTokens } from '@/utils/auth';
import logger from './logger';
import { config } from './config';

// OAuth configuration
export const oauthConfig = {
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

// Initialize Passport
export const initializeOAuth = () => {
  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id },
        include: { preferences: true },
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  if (oauthConfig.google.clientID && oauthConfig.google.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: oauthConfig.google.clientID,
          clientSecret: oauthConfig.google.clientSecret,
          callbackURL: oauthConfig.google.callbackURL,
          scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const prisma = getPrismaClient();
            
            // Check if user already exists with this Google ID
            let user = await prisma.user.findFirst({
              where: {
                email: profile.emails?.[0]?.value || '',
              },
              include: { preferences: true },
            });

            if (user) {
              // User exists, update their info
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  firstName: profile.name?.givenName || user.firstName,
                  lastName: profile.name?.familyName || user.lastName,
                  avatar: profile.photos?.[0]?.value || user.avatar,
                  isVerified: true, // OAuth users are considered verified
                },
                include: { preferences: true },
              });

              logger.info('Google OAuth: Existing user logged in', {
                userId: user.id,
                email: user.email,
              });
            } else {
              // Create new user
              user = await prisma.user.create({
                data: {
                  email: profile.emails?.[0]?.value || '',
                  firstName: profile.name?.givenName || '',
                  lastName: profile.name?.familyName || '',
                  avatar: profile.photos?.[0]?.value || null,
                  password: '', // OAuth users don't need password
                  isVerified: true,
                  preferences: {
                    create: {}, // Default preferences
                  },
                },
                include: { preferences: true },
              });

              logger.info('Google OAuth: New user created', {
                userId: user.id,
                email: user.email,
              });
            }

            return done(null, user);
          } catch (error) {
            logger.error('Google OAuth error', { error });
            return done(error, undefined);
          }
        }
      )
    );
  }

  // Apple OAuth Strategy (using a generic approach since passport-apple might need custom implementation)
  // Apple Sign-In requires more complex setup with JWT verification
  // This is a placeholder for now - would need to implement custom Apple Sign-In verification
  
  logger.info('OAuth strategies initialized', {
    google: !!oauthConfig.google.clientID,
    apple: !!oauthConfig.apple.clientID,
  });
};

// Helper function to generate OAuth redirect URL
export const getOAuthRedirectURL = (provider: 'google' | 'apple', state?: string) => {
  const baseUrl = 'http://localhost:5000'; // config.server.baseUrl ||
  const redirectUrl = `${baseUrl}/api/v1/auth/${provider}`;
  
  if (state) {
    return `${redirectUrl}?state=${encodeURIComponent(state)}`;
  }
  
  return redirectUrl;
};

// OAuth success handler
export const handleOAuthSuccess = async (user: any, req: any, res: any) => {
  try {
    const tokens = generateTokens(user);
    
    // Update refresh token in database
    const prisma = getPrismaClient();
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    // Create user session
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        deviceType: req.get('User-Agent') || null,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Redirect to frontend with tokens (in production, use more secure method)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/oauth-success?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('OAuth success handler error', { error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/oauth-error?message=${encodeURIComponent('Authentication failed')}`);
  }
};

// OAuth error handler
export const handleOAuthError = (error: any, req: any, res: any) => {
  logger.error('OAuth error', { error });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/auth/oauth-error?message=${encodeURIComponent('Authentication failed')}`);
};