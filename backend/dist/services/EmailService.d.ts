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
export declare class EmailService {
    private transporter;
    private templates;
    constructor();
    private initializeTransporter;
    private loadTemplates;
    sendTemplateEmail(userIdOrEmail: string, templateName: string, templateData?: Record<string, any>): Promise<void>;
    sendEmail(options: EmailOptions): Promise<void>;
    sendBulkEmails(emails: Array<{
        to: string;
        templateName: string;
        templateData?: Record<string, any>;
    }>, delayMs?: number): Promise<void>;
    verifyConnection(): Promise<boolean>;
    private processTemplate;
    addTemplate(name: string, template: EmailTemplate): void;
    getTemplate(name: string): EmailTemplate | undefined;
    listTemplates(): string[];
}
//# sourceMappingURL=EmailService.d.ts.map