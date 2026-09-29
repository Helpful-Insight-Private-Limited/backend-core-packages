export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Enterprise Reusable REST API',
    version: '1.0.0',
    description:
      'Reusable enterprise REST API boilerplate with Auth, RBAC, i18n, Logger, Mailer, Notifications, Templates, and Field Validators.'
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'alex@example.com' },
                  password: { type: 'string', example: 'SuperSecure@Pass123' },
                  name: { type: 'string', example: 'Alex Developer' },
                  phone: { type: 'string', example: '+14155552671' },
                  language: { type: 'string', example: 'en' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'User successfully registered' },
          400: { description: 'Validation failed' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Authenticate user with email and password',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@enterprise.com' },
                  password: { type: 'string', example: 'Admin@Pass123!' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'JWT tokens generated' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/api/users/me': {
      get: {
        summary: 'Get current user profile and permissions',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profile returned' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/api/users': {
      get: {
        summary: 'List users (Requires RBAC permission: users:read)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of users' },
          403: { description: 'Forbidden - insufficient permissions' }
        }
      }
    },
    '/api/notifications': {
      get: {
        summary: 'Get user in-app notifications',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Notifications list' }
        }
      }
    },
    '/api/notifications/stream': {
      get: {
        summary: 'SSE Stream for real-time live notifications',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Event stream established' }
        }
      }
    },
    '/api/templates': {
      get: {
        summary: 'List email templates',
        tags: ['Email Templates'],
        responses: {
          200: { description: 'List of templates' }
        }
      }
    },
    '/api/audit': {
      get: {
        summary: 'View audit logs (Requires Admin role)',
        tags: ['Audit & Compliance'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Audit trail records' }
        }
      }
    }
  }
};
