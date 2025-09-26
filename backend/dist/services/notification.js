"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("@/config/env");
const logger_1 = require("@/config/logger");
const redis_1 = require("@/config/redis");
const database_1 = require("@/config/database");
const error_1 = require("@/utils/error");
const analytics_1 = require("./analytics");
class NotificationService {
    constructor() {
        this.fcmServerKey = env_1.config.firebase.serverKey;
        this.setupEmailTransporter();
    }
    setupEmailTransporter() {
        this.emailTransporter = nodemailer_1.default.createTransporter({
            host: env_1.config.email.host,
            port: env_1.config.email.port,
            secure: env_1.config.email.secure,
            auth: {
                user: env_1.config.email.user,
                pass: env_1.config.email.password,
            },
        });
    }
    async sendNotification(type, recipient, data = {}) {
        try {
            logger_1.logger.info('Sending notification', {
                type,
                userId: recipient.userId,
                channels: {
                    email: !!recipient.email && recipient.preferences?.email,
                    push: !!recipient.pushTokens?.length && recipient.preferences?.push,
                },
            });
            const promises = [];
            if (recipient.email && recipient.preferences?.email) {
                promises.push(this.sendEmailNotification(type, recipient.email, data));
            }
            if (recipient.pushTokens?.length && recipient.preferences?.push) {
                promises.push(this.sendPushNotification(type, recipient.pushTokens, data));
            }
            await Promise.allSettled(promises);
            await analytics_1.analyticsService.trackEvent({
                userId: recipient.userId,
                event: 'notification_sent',
                properties: {
                    type,
                    channels: {
                        email: !!recipient.email && recipient.preferences?.email,
                        push: !!recipient.pushTokens?.length && recipient.preferences?.push,
                    },
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error sending notification:', error);
            throw new error_1.AppError('Failed to send notification', 500);
        }
    }
    async sendBulkNotification(type, recipients, data = {}) {
        try {
            logger_1.logger.info('Sending bulk notification', {
                type,
                recipientCount: recipients.length,
            });
            const batchSize = 10;
            for (let i = 0; i < recipients.length; i += batchSize) {
                const batch = recipients.slice(i, i + batchSize);
                const promises = batch.map(recipient => this.sendNotification(type, recipient, data));
                await Promise.allSettled(promises);
                if (i + batchSize < recipients.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error sending bulk notifications:', error);
            throw new error_1.AppError('Failed to send bulk notifications', 500);
        }
    }
    async sendEmailNotification(type, email, data) {
        try {
            const template = this.getEmailTemplate(type, data);
            const mailOptions = {
                from: env_1.config.email.from,
                to: email,
                subject: template.subject,
                text: template.text,
                html: template.html,
            };
            await this.emailTransporter.sendMail(mailOptions);
            logger_1.logger.debug('Email notification sent', {
                type,
                email,
                subject: template.subject,
            });
        }
        catch (error) {
            logger_1.logger.error('Error sending email notification:', error);
            throw error;
        }
    }
    async sendPushNotification(type, pushTokens, data) {
        try {
            if (!this.fcmServerKey) {
                logger_1.logger.warn('FCM server key not configured, skipping push notification');
                return;
            }
            const notification = this.getPushNotificationContent(type, data);
            const fcmPayload = {
                registration_ids: pushTokens,
                notification: {
                    title: notification.title,
                    body: notification.body,
                    icon: notification.icon || '/images/icon-192x192.png',
                    badge: notification.badge || '/images/badge-72x72.png',
                },
                data: {
                    type,
                    ...notification.data,
                },
            };
            const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                    'Authorization': `key=${this.fcmServerKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(fcmPayload),
            });
            if (!response.ok) {
                throw new Error(`FCM API error: ${response.status}`);
            }
            logger_1.logger.debug('Push notification sent', {
                type,
                tokenCount: pushTokens.length,
                title: notification.title,
            });
        }
        catch (error) {
            logger_1.logger.error('Error sending push notification:', error);
            throw error;
        }
    }
    getEmailTemplate(type, data) {
        const templates = {
            friend_request: (data) => ({
                subject: 'New Friend Request - PathFinder Pro',
                html: `
          <h2>New Friend Request</h2>
          <p>Hi ${data.recipientName},</p>
          <p><strong>${data.senderName}</strong> has sent you a friend request on PathFinder Pro.</p>
          <p>
            <a href="${env_1.config.app.frontendUrl}/friends/requests" 
               style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Friend Request
            </a>
          </p>
          <p>Best regards,<br>The PathFinder Pro Team</p>
        `,
                text: `Hi ${data.recipientName},\n\n${data.senderName} has sent you a friend request on PathFinder Pro.\n\nView your friend requests at: ${env_1.config.app.frontendUrl}/friends/requests\n\nBest regards,\nThe PathFinder Pro Team`,
            }),
            friend_request_accepted: (data) => ({
                subject: 'Friend Request Accepted - PathFinder Pro',
                html: `
          <h2>Friend Request Accepted</h2>
          <p>Hi ${data.recipientName},</p>
          <p><strong>${data.senderName}</strong> has accepted your friend request on PathFinder Pro!</p>
          <p>You can now share routes and places with each other.</p>
          <p>
            <a href="${env_1.config.app.frontendUrl}/friends" 
               style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Friends
            </a>
          </p>
          <p>Best regards,<br>The PathFinder Pro Team</p>
        `,
                text: `Hi ${data.recipientName},\n\n${data.senderName} has accepted your friend request on PathFinder Pro!\n\nYou can now share routes and places with each other.\n\nView your friends at: ${env_1.config.app.frontendUrl}/friends\n\nBest regards,\nThe PathFinder Pro Team`,
            }),
            route_shared: (data) => ({
                subject: `${data.senderName} shared a route with you - PathFinder Pro`,
                html: `
          <h2>Route Shared</h2>
          <p>Hi ${data.recipientName},</p>
          <p><strong>${data.senderName}</strong> has shared a route with you: <strong>${data.routeName}</strong></p>
          ${data.message ? `<p><em>"${data.message}"</em></p>` : ''}
          <p>Distance: ${data.distance} • Duration: ${data.duration}</p>
          <p>
            <a href="${env_1.config.app.frontendUrl}/routes/shared/${data.routeId}" 
               style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Route
            </a>
          </p>
          <p>Best regards,<br>The PathFinder Pro Team</p>
        `,
                text: `Hi ${data.recipientName},\n\n${data.senderName} has shared a route with you: ${data.routeName}\n\n${data.message ? `Message: "${data.message}"\n\n` : ''}Distance: ${data.distance} • Duration: ${data.duration}\n\nView the route at: ${env_1.config.app.frontendUrl}/routes/shared/${data.routeId}\n\nBest regards,\nThe PathFinder Pro Team`,
            }),
            place_shared: (data) => ({
                subject: `${data.senderName} shared a place with you - PathFinder Pro`,
                html: `
          <h2>Place Shared</h2>
          <p>Hi ${data.recipientName},</p>
          <p><strong>${data.senderName}</strong> has shared a place with you: <strong>${data.placeName}</strong></p>
          ${data.message ? `<p><em>"${data.message}"</em></p>` : ''}
          <p>Address: ${data.address}</p>
          <p>Category: ${data.category}</p>
          <p>
            <a href="${env_1.config.app.frontendUrl}/places/shared/${data.placeId}" 
               style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Place
            </a>
          </p>
          <p>Best regards,<br>The PathFinder Pro Team</p>
        `,
                text: `Hi ${data.recipientName},\n\n${data.senderName} has shared a place with you: ${data.placeName}\n\n${data.message ? `Message: "${data.message}"\n\n` : ''}Address: ${data.address}\nCategory: ${data.category}\n\nView the place at: ${env_1.config.app.frontendUrl}/places/shared/${data.placeId}\n\nBest regards,\nThe PathFinder Pro Team`,
            }),
            weather_alert: (data) => ({
                subject: `Weather Alert - ${data.alertTitle}`,
                html: `
          <h2>Weather Alert</h2>
          <p>Hi ${data.recipientName},</p>
          <p><strong>Alert:</strong> ${data.alertTitle}</p>
          <p><strong>Severity:</strong> ${data.severity}</p>
          <p>${data.description}</p>
          <p><strong>Affected Area:</strong> ${data.area}</p>
          <p><strong>Valid:</strong> ${data.startTime} - ${data.endTime}</p>
          <p>Please take appropriate precautions and consider adjusting your travel plans.</p>
          <p>Best regards,<br>The PathFinder Pro Team</p>
        `,
                text: `Weather Alert: ${data.alertTitle}\n\nSeverity: ${data.severity}\n\n${data.description}\n\nAffected Area: ${data.area}\nValid: ${data.startTime} - ${data.endTime}\n\nPlease take appropriate precautions and consider adjusting your travel plans.\n\nBest regards,\nThe PathFinder Pro Team`,
            }),
            welcome: (data) => ({
                subject: 'Welcome to PathFinder Pro!',
                html: `
          <h2>Welcome to PathFinder Pro!</h2>
          <p>Hi ${data.firstName},</p>
          <p>Thank you for joining PathFinder Pro! We're excited to help you navigate and explore the world around you.</p>
          <p>Here's what you can do to get started:</p>
          <ul>
            <li>Plan and save your favorite routes</li>
            <li>Discover and bookmark interesting places</li>
            <li>Connect with friends and share your adventures</li>
            <li>Get real-time weather updates for your travels</li>
          </ul>
          <p>
            <a href="${env_1.config.app.frontendUrl}/onboarding" 
               style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Complete Setup
            </a>
          </p>
          <p>If you have any questions, feel free to contact our support team.</p>
          <p>Happy exploring!<br>The PathFinder Pro Team</p>
        `,
                text: `Welcome to PathFinder Pro!\n\nHi ${data.firstName},\n\nThank you for joining PathFinder Pro! We're excited to help you navigate and explore the world around you.\n\nHere's what you can do to get started:\n• Plan and save your favorite routes\n• Discover and bookmark interesting places\n• Connect with friends and share your adventures\n• Get real-time weather updates for your travels\n\nComplete your setup at: ${env_1.config.app.frontendUrl}/onboarding\n\nIf you have any questions, feel free to contact our support team.\n\nHappy exploring!\nThe PathFinder Pro Team`,
            }),
            trip_started: (data) => ({ subject: '', html: '', text: '' }),
            trip_ended: (data) => ({ subject: '', html: '', text: '' }),
            system_maintenance: (data) => ({ subject: '', html: '', text: '' }),
            password_changed: (data) => ({ subject: '', html: '', text: '' }),
            account_deleted: (data) => ({ subject: '', html: '', text: '' }),
        };
        const templateFn = templates[type];
        if (!templateFn) {
            throw new Error(`No email template found for notification type: ${type}`);
        }
        return templateFn(data);
    }
    getPushNotificationContent(type, data) {
        const notifications = {
            friend_request: (data) => ({
                title: 'New Friend Request',
                body: `${data.senderName} wants to be your friend`,
                data: { type: 'friend_request', requestId: data.requestId },
            }),
            friend_request_accepted: (data) => ({
                title: 'Friend Request Accepted',
                body: `${data.senderName} accepted your friend request`,
                data: { type: 'friend_request_accepted', friendId: data.senderId },
            }),
            route_shared: (data) => ({
                title: 'Route Shared',
                body: `${data.senderName} shared "${data.routeName}" with you`,
                data: { type: 'route_shared', routeId: data.routeId },
            }),
            place_shared: (data) => ({
                title: 'Place Shared',
                body: `${data.senderName} shared "${data.placeName}" with you`,
                data: { type: 'place_shared', placeId: data.placeId },
            }),
            trip_started: (data) => ({
                title: 'Trip Started',
                body: `${data.friendName} started a trip`,
                data: { type: 'trip_started', tripId: data.tripId },
            }),
            trip_ended: (data) => ({
                title: 'Trip Ended',
                body: `${data.friendName} completed their trip`,
                data: { type: 'trip_ended', tripId: data.tripId },
            }),
            weather_alert: (data) => ({
                title: 'Weather Alert',
                body: `${data.severity.toUpperCase()}: ${data.alertTitle}`,
                data: { type: 'weather_alert', alertId: data.alertId },
            }),
            welcome: (data) => ({
                title: 'Welcome to PathFinder Pro!',
                body: 'Start exploring and planning your adventures',
                data: { type: 'welcome' },
            }),
            system_maintenance: (data) => ({ title: '', body: '', data: {} }),
            password_changed: (data) => ({ title: '', body: '', data: {} }),
            account_deleted: (data) => ({ title: '', body: '', data: {} }),
        };
        const notificationFn = notifications[type];
        if (!notificationFn) {
            throw new Error(`No push notification content found for type: ${type}`);
        }
        return notificationFn(data);
    }
    async sendWelcomeEmail(userId, email, firstName) {
        const recipient = {
            userId,
            email,
            preferences: { email: true, push: false, sms: false },
        };
        await this.sendNotification('welcome', recipient, { firstName });
    }
    async sendFriendRequestNotification(recipientId, senderName, requestId) {
        const recipient = await this.getUserNotificationSettings(recipientId);
        await this.sendNotification('friend_request', recipient, {
            senderName,
            requestId,
            recipientName: recipient.firstName,
        });
    }
    async sendRouteSharedNotification(recipientIds, senderName, routeData, message) {
        const recipients = await Promise.all(recipientIds.map(id => this.getUserNotificationSettings(id)));
        await this.sendBulkNotification('route_shared', recipients, {
            senderName,
            routeId: routeData.id,
            routeName: routeData.name,
            distance: routeData.distance,
            duration: routeData.duration,
            message,
        });
    }
    async getUserNotificationSettings(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                preferences: {
                    select: {
                        notifications: true,
                    },
                },
            },
        });
        if (!user) {
            throw new error_1.AppError('User not found', 404);
        }
        let preferences = { email: true, push: true, sms: false };
        if (user.preferences?.notifications) {
            try {
                preferences = JSON.parse(user.preferences.notifications);
            }
            catch (error) {
                logger_1.logger.warn('Failed to parse user notification preferences:', error);
            }
        }
        const pushTokens = [];
        try {
            const tokens = await redis_1.redisClient.smembers(`push_tokens:${userId}`);
            pushTokens.push(...tokens);
        }
        catch (error) {
            logger_1.logger.warn('Failed to get push tokens:', error);
        }
        return {
            userId,
            email: user.email,
            firstName: user.firstName,
            pushTokens,
            preferences,
        };
    }
    async registerPushToken(userId, token) {
        try {
            await redis_1.redisClient.sadd(`push_tokens:${userId}`, token);
            await redis_1.redisClient.expire(`push_tokens:${userId}`, 86400 * 30);
            logger_1.logger.info('Push token registered', { userId, token: token.substring(0, 20) + '...' });
        }
        catch (error) {
            logger_1.logger.error('Error registering push token:', error);
            throw new error_1.AppError('Failed to register push token', 500);
        }
    }
    async unregisterPushToken(userId, token) {
        try {
            await redis_1.redisClient.srem(`push_tokens:${userId}`, token);
            logger_1.logger.info('Push token unregistered', { userId, token: token.substring(0, 20) + '...' });
        }
        catch (error) {
            logger_1.logger.error('Error unregistering push token:', error);
            throw new error_1.AppError('Failed to unregister push token', 500);
        }
    }
}
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.js.map