import nodemailer from 'nodemailer';
import { AppError } from '@/utils/error';
import { logger } from '@/config/logger';
import { config } from '@/config/env';
import { prisma } from '@/config/database';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.initializeTransporter();
    this.loadTemplates();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    try {
      // Configure based on environment
      if (config.node.env === 'production') {
        // Production email service (e.g., SendGrid, AWS SES)
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY,
          },
        });
      } else {
        // Development/testing with Gmail or test account
        this.transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      }

      logger.info('Email transporter initialized');
    } catch (error) {
      logger.error('Failed to initialize email transporter', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Load email templates
   */
  private loadTemplates(): void {
    // Welcome email template
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

    // Email verification template
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

    // Password reset template
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

    // Route sharing template
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

    // Analytics report template
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

    logger.info('Email templates loaded', {
      templateCount: this.templates.size,
    });
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    userIdOrEmail: string,
    templateName: string,
    templateData: Record<string, any> = {}
  ): Promise<void> {
    try {
      const template = this.templates.get(templateName);
      if (!template) {
        throw new AppError(`Email template '${templateName}' not found`, 404);
      }

      let email: string;
      let firstName: string = 'there';

      // Check if userIdOrEmail is an email or user ID
      if (userIdOrEmail.includes('@')) {
        email = userIdOrEmail;
      } else {
        // Fetch user by ID
        const user = await prisma.user.findUnique({
          where: { id: userIdOrEmail },
          select: { email: true, firstName: true },
        });

        if (!user) {
          throw new AppError('User not found', 404);
        }

        email = user.email;
        firstName = user.firstName || 'there';
      }

      // Merge template data with user info
      const data = {
        firstName,
        ...templateData,
      };

      // Process template
      const subject = this.processTemplate(template.subject, data);
      const html = this.processTemplate(template.html, data);
      const text = template.text ? this.processTemplate(template.text, data) : undefined;

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info('Template email sent', {
        template: templateName,
        recipient: email,
      });
    } catch (error) {
      logger.error('Failed to send template email', {
        template: templateName,
        userIdOrEmail,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send email directly
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.SMTP_FROM || 'noreply@pathfinderpro.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: result.messageId,
        recipient: options.to,
        subject: options.subject,
      });
    } catch (error) {
      logger.error('Failed to send email', {
        recipient: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to send email', 500);
    }
  }

  /**
   * Send bulk emails (with rate limiting)
   */
  async sendBulkEmails(
    emails: Array<{
      to: string;
      templateName: string;
      templateData?: Record<string, any>;
    }>,
    delayMs: number = 1000
  ): Promise<void> {
    try {
      logger.info('Starting bulk email send', {
        count: emails.length,
        delayMs,
      });

      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        
        try {
          await this.sendTemplateEmail(
            email.to,
            email.templateName,
            email.templateData
          );

          // Add delay between emails to avoid rate limits
          if (i < emails.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } catch (error) {
          logger.error('Failed to send bulk email item', {
            index: i,
            recipient: email.to,
            template: email.templateName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Continue with next email instead of failing entire batch
        }
      }

      logger.info('Bulk email send completed', {
        count: emails.length,
      });
    } catch (error) {
      logger.error('Bulk email send failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify email service connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Process template with data substitution
   */
  private processTemplate(template: string, data: Record<string, any>): string {
    let processed = template;

    // Simple template processing (replace {{key}} with value)
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const stringValue = value?.toString() || '';
      processed = processed.replace(new RegExp(placeholder, 'g'), stringValue);
    });

    // Handle conditional blocks {{#if condition}}...{{/if}}
    processed = processed.replace(
      /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
      (match, condition, content) => {
        return data[condition] ? content : '';
      }
    );

    // Handle loops {{#each array}}...{{/each}}
    processed = processed.replace(
      /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g,
      (match, arrayName, content) => {
        const array = data[arrayName];
        if (!Array.isArray(array)) return '';

        return array.map((item, index) => {
          let itemContent = content;
          // Replace {{this}} with current item
          itemContent = itemContent.replace(/{{this}}/g, item.toString());
          // Replace {{@key}} with property names for objects
          if (typeof item === 'object' && item !== null) {
            Object.entries(item).forEach(([key, value]) => {
              itemContent = itemContent.replace(
                new RegExp(`{{@${key}}}`, 'g'),
                key
              );
              itemContent = itemContent.replace(
                new RegExp(`{{${key}}}`, 'g'),
                value?.toString() || ''
              );
            });
          }
          return itemContent;
        }).join('');
      }
    );

    return processed;
  }

  /**
   * Add custom template
   */
  addTemplate(name: string, template: EmailTemplate): void {
    this.templates.set(name, template);
    logger.info('Custom email template added', { name });
  }

  /**
   * Get template
   */
  getTemplate(name: string): EmailTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * List all template names
   */
  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}