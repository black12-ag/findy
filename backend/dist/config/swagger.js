"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const config_1 = require("./config");
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'PathFinder Pro API',
        version: '1.0.0',
        description: 'A comprehensive navigation and location services API for PathFinder Pro mobile application',
        contact: {
            name: 'PathFinder Pro Team',
            email: 'support@pathfinderpro.com',
            url: 'https://pathfinderpro.com'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT',
        },
    },
    servers: [
        {
            url: config_1.config.node.env === 'production'
                ? 'https://api.pathfinderpro.com/api/v1'
                : `http://localhost:${config_1.config.server.port}/api/v1`,
            description: config_1.config.node.env === 'production' ? 'Production server' : 'Development server',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT token for authentication',
            },
            refreshToken: {
                type: 'apiKey',
                in: 'header',
                name: 'X-Refresh-Token',
                description: 'Refresh token for getting new access tokens',
            },
        },
        schemas: {
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'cuid' },
                    email: { type: 'string', format: 'email' },
                    username: { type: 'string' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    avatar: { type: 'string', format: 'url' },
                    phoneNumber: { type: 'string' },
                    isVerified: { type: 'boolean' },
                    isActive: { type: 'boolean' },
                    role: { type: 'string', enum: ['USER', 'ADMIN', 'MODERATOR'] },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Place: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'cuid' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    address: { type: 'string' },
                    latitude: { type: 'number', format: 'double' },
                    longitude: { type: 'number', format: 'double' },
                    category: { type: 'string' },
                    subcategory: { type: 'string' },
                    rating: { type: 'number', format: 'float', minimum: 0, maximum: 5 },
                    priceLevel: { type: 'integer', minimum: 1, maximum: 4 },
                    phoneNumber: { type: 'string' },
                    website: { type: 'string', format: 'url' },
                    photos: { type: 'array', items: { type: 'string', format: 'url' } },
                    amenities: { type: 'array', items: { type: 'string' } },
                    isVerified: { type: 'boolean' },
                    googlePlaceId: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Route: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'cuid' },
                    name: { type: 'string' },
                    transportMode: { type: 'string', enum: ['DRIVING', 'WALKING', 'TRANSIT', 'CYCLING'] },
                    startLatitude: { type: 'number', format: 'double' },
                    startLongitude: { type: 'number', format: 'double' },
                    startAddress: { type: 'string' },
                    endLatitude: { type: 'number', format: 'double' },
                    endLongitude: { type: 'number', format: 'double' },
                    endAddress: { type: 'string' },
                    distance: { type: 'number', format: 'float' },
                    duration: { type: 'integer' },
                    avoidTolls: { type: 'boolean' },
                    avoidHighways: { type: 'boolean' },
                    avoidFerries: { type: 'boolean' },
                    status: { type: 'string', enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            ApiResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { type: 'object' },
                    error: { type: 'string' },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string' },
                    error: { type: 'string' },
                },
            },
            LoginRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                },
            },
            RegisterRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    username: { type: 'string', minLength: 3 },
                },
            },
            AuthTokens: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresIn: { type: 'integer' },
                    tokenType: { type: 'string', example: 'Bearer' },
                },
            },
        },
        responses: {
            UnauthorizedError: {
                description: 'Authentication information is missing or invalid',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error',
                        },
                        example: {
                            success: false,
                            message: 'Authentication required',
                        },
                    },
                },
            },
            ForbiddenError: {
                description: 'Insufficient permissions',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error',
                        },
                        example: {
                            success: false,
                            message: 'Insufficient permissions',
                        },
                    },
                },
            },
            NotFoundError: {
                description: 'Resource not found',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error',
                        },
                        example: {
                            success: false,
                            message: 'Resource not found',
                        },
                    },
                },
            },
            ValidationError: {
                description: 'Validation error',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error',
                        },
                        example: {
                            success: false,
                            message: 'Validation failed',
                            data: [
                                {
                                    field: 'email',
                                    message: 'Invalid email format',
                                },
                            ],
                        },
                    },
                },
            },
        },
    },
    tags: [
        {
            name: 'Authentication',
            description: 'User authentication and authorization',
        },
        {
            name: 'Users',
            description: 'User management and profiles',
        },
        {
            name: 'Places',
            description: 'Location and place management',
        },
        {
            name: 'Routes',
            description: 'Route planning and navigation',
        },
        {
            name: 'Social',
            description: 'Social features and interactions',
        },
    ],
};
const options = {
    definition: swaggerDefinition,
    apis: [
        './src/routes/*.ts',
        './src/controllers/*.ts',
        './src/models/*.ts',
    ],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
const setupSwagger = (app) => {
    app.get('/api/v1/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(exports.swaggerSpec);
    });
    const swaggerUiOptions = {
        explorer: true,
        customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0 }
      .swagger-ui .scheme-container { background: #fafafa; padding: 30px 0 }
    `,
        customSiteTitle: 'PathFinder Pro API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
            docExpansion: 'list',
            filter: true,
            showRequestDuration: true,
            syntaxHighlight: {
                theme: 'agate',
            },
            tryItOutEnabled: true,
        },
    };
    app.use('/api/v1/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(exports.swaggerSpec, swaggerUiOptions));
    console.log(`📚 API Documentation available at http://localhost:${config_1.config.server.port}/api/v1/docs`);
};
exports.setupSwagger = setupSwagger;
//# sourceMappingURL=swagger.js.map