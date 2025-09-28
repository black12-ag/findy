"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const error_1 = require("@/utils/error");
const logger_1 = require("@/config/logger");
const env_1 = require("@/config/env");
const database_1 = require("@/config/database");
class EmailService {
    constructor() {
        this.templates = new Map();
        this.initializeTransporter();
        this.loadTemplates();
    }
    initializeTransporter() {
        try {
            if (env_1.config.node.env === 'production') {
                this.transporter = nodemailer_1.default.createTransporter({
                    service: 'SendGrid',
                    auth: {
                        user: 'apikey',
                        pass: process.env.SENDGRID_API_KEY,
                    },
                });
            }
            else {
                this.transporter = nodemailer_1.default.createTransporter({
                    service: 'gmail',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });
            }
            logger_1.logger.info('Email transporter initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize email transporter', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    loadTemplates() {
        this.templates.set('welcome', {
            subject: 'Welcome to PathFinder Pro!',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to PathFinder Pro!</h1>
          <p>Hi {{firstName}},</p>
          <p>Thank you for joining PathFinder Pro. We're excited to help you navigate your world with ease.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Get Started:</h3>
            <ul>
              <li>Verify your email address by clicking the link below</li>
              <li>Set your navigation preferences</li>
              <li>Start planning your first route</li>
            </ul>
          </div>
          
          <a href="{{verifyUrl}}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Verify Email Address
          </a>
          
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Happy navigating!</p>
          <p>The PathFinder Pro Team</p>
        </div>
      `,
            text: `
        Welcome to PathFinder Pro!
        
        Hi {{firstName}},
        
        Thank you for joining PathFinder Pro. We're excited to help you navigate your world with ease.
        
        To get started:
        1. Verify your email address: {{verifyUrl}}
        2. Set your navigation preferences
        3. Start planning your first route
        
        If you have any questions, feel free to reach out to our support team.
        
        Happy navigating!
        The PathFinder Pro Team
      `,
        });
        this.templates.set('email_verification', {
            subject: 'Verify Your Email Address',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Verify Your Email</h1>
          <p>Hi {{firstName}},</p>
          <p>Please click the button below to verify your email address:</p>
          
          <a href="{{verifyUrl}}" 
             style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Verify Email
          </a>
          
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
        });
        this.templates.set('password_reset', {
            subject: 'Reset Your Password',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Reset Your Password</h1>
          <p>Hi {{firstName}},</p>
          <p>You requested to reset your password. Click the button below to set a new password:</p>
          
          <a href="{{resetUrl}}" 
             style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
        });
        this.templates.set('route_shared', {
            subject: '{{senderName}} shared a route with you',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Route Shared</h1>
          <p>Hi {{recipientName}},</p>
          <p>{{senderName}} has shared a route with you:</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>{{routeName}}</h3>
            <p><strong>From:</strong> {{startAddress}}</p>
            <p><strong>To:</strong> {{endAddress}}</p>
            <p><strong>Distance:</strong> {{distance}}</p>
            <p><strong>Duration:</strong> {{duration}}</p>
            {{#if message}}
            <p><strong>Message:</strong> {{message}}</p>
            {{/if}}
          </div>
          
          <a href="{{routeUrl}}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            View Route
          </a>
        </div>
      `,
        });
        this.templates.set('analytics_report', {
            subject: 'Your {{reportType}} Analytics Report',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">{{title}}</h1>
          <p>Hi there,</p>
          <p>Here's your {{reportType}} analytics report:</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Key Metrics</h3>
            {{#each metrics}}
            <p><strong>{{@key}}:</strong> {{this}}</p>
            {{/each}}
          </div>
          
          {{#if insights.length}}
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Insights</h3>
            <ul>
            {{#each insights}}
              <li>{{this}}</li>
            {{/each}}
            </ul>
          </div>
          {{/if}}
          
          {{#if recommendations.length}}
          <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Recommendations</h3>
            <ul>
            {{#each recommendations}}
              <li>{{this}}</li>
            {{/each}}
            </ul>
          </div>
          {{/if}}
          
          <p>Keep up the great navigation!</p>
          <p>The PathFinder Pro Team</p>
        </div>
      `,
        });
        logger_1.logger.info('Email templates loaded', {
            templateCount: this.templates.size,
        });
    }
    async sendTemplateEmail(userIdOrEmail, templateName, templateData = {}) {
        try {
            const template = this.templates.get(templateName);
            if (!template) {
                throw new error_1.AppError(`Email template '${templateName}' not found`, 404);
            }
            let email;
            let firstName = 'there';
            if (userIdOrEmail.includes('@')) {
                email = userIdOrEmail;
            }
            else {
                const user = await database_1.prisma.user.findUnique({
                    where: { id: userIdOrEmail },
                    select: { email: true, firstName: true },
                });
                if (!user) {
                    throw new error_1.AppError('User not found', 404);
                }
                email = user.email;
                firstName = user.firstName || 'there';
            }
            const data = {
                firstName,
                ...templateData,
            };
            const subject = this.processTemplate(template.subject, data);
            const html = this.processTemplate(template.html, data);
            const text = template.text ? this.processTemplate(template.text, data) : undefined;
            await this.sendEmail({
                to: email,
                subject,
                html,
                text,
            });
            logger_1.logger.info('Template email sent', {
                template: templateName,
                recipient: email,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send template email', {
                template: templateName,
                userIdOrEmail,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async sendEmail(options) {
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM || 'noreply@pathfinderpro.com',
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
                attachments: options.attachments,
            };
            const result = await this.transporter.sendMail(mailOptions);
            logger_1.logger.info('Email sent successfully', {
                messageId: result.messageId,
                recipient: options.to,
                subject: options.subject,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send email', {
                recipient: options.to,
                subject: options.subject,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to send email', 500);
        }
    }
    async sendBulkEmails(emails, delayMs = 1000) {
        try {
            logger_1.logger.info('Starting bulk email send', {
                count: emails.length,
                delayMs,
            });
            for (let i = 0; i < emails.length; i++) {
                const email = emails[i];
                try {
                    await this.sendTemplateEmail(email.to, email.templateName, email.templateData);
                    if (i < emails.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                }
                catch (error) {
                    logger_1.logger.error('Failed to send bulk email item', {
                        index: i,
                        recipient: email.to,
                        template: email.templateName,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            logger_1.logger.info('Bulk email send completed', {
                count: emails.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Bulk email send failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async verifyConnection() {
        try {
            await this.transporter.verify();
            logger_1.logger.info('Email service connection verified');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Email service connection failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    processTemplate(template, data) {
        let processed = template;
        Object.entries(data).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            const stringValue = value?.toString() || '';
            processed = processed.replace(new RegExp(placeholder, 'g'), stringValue);
        });
        processed = processed.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
            return data[condition] ? content : '';
        });
        processed = processed.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
            const array = data[arrayName];
            if (!Array.isArray(array))
                return '';
            return array.map((item, index) => {
                let itemContent = content;
                itemContent = itemContent.replace(/{{this}}/g, item.toString());
                if (typeof item === 'object' && item !== null) {
                    Object.entries(item).forEach(([key, value]) => {
                        itemContent = itemContent.replace(new RegExp(`{{@${key}}}`, 'g'), key);
                        itemContent = itemContent.replace(new RegExp(`{{${key}}}`, 'g'), value?.toString() || '');
                    });
                }
                return itemContent;
            }).join('');
        });
        return processed;
    }
    addTemplate(name, template) {
        this.templates.set(name, template);
        logger_1.logger.info('Custom email template added', { name });
    }
    getTemplate(name) {
        return this.templates.get(name);
    }
    listTemplates() {
        return Array.from(this.templates.keys());
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=EmailService.js.map