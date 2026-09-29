import { Router, Request, Response } from 'express';
import { NotificationService } from './dispatcher.js';

export function createNotificationRouter(service: NotificationService): Router {
  const router = Router();
  const inAppHandler = service.getInAppHandler();

  // Helper to extract user ID from authenticated request
  const getUserId = (req: Request): string | undefined => {
    return (req as any).user?.id || (req as any).user?.sub;
  };

  // Get in-app notifications
  router.get('/', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!inAppHandler) {
      res.status(500).json({ success: false, error: 'In-app notification handler not configured' });
      return;
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await inAppHandler.getStore().getUserNotifications(userId, unreadOnly);
    res.json({ success: true, data: notifications });
  });

  // Mark single as read
  router.patch('/:id/read', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!inAppHandler) {
      res.status(500).json({ success: false, error: 'In-app handler not configured' });
      return;
    }

    const notifId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await inAppHandler.getStore().markAsRead(notifId, userId);
    res.json({ success: true, updated });
  });

  // Mark all as read
  router.post('/read-all', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!inAppHandler) {
      res.status(500).json({ success: false, error: 'In-app handler not configured' });
      return;
    }

    const count = await inAppHandler.getStore().markAllAsRead(userId);
    res.json({ success: true, count });
  });

  // Server-Sent Events (SSE) stream for real-time notifications
  router.get('/stream', (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!inAppHandler) {
      res.status(500).json({ success: false, error: 'In-app handler not configured' });
      return;
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send connection greeting
    res.write(`data: ${JSON.stringify({ event: 'connected', userId })}\n\n`);

    // Subscribe to live notifications
    const unsubscribe = inAppHandler.subscribe(userId, (notif) => {
      res.write(`data: ${JSON.stringify(notif)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // Get user preferences
  router.get('/preferences', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const prefs = await service.getPreferencesStore().getUserPreferences(userId);
    res.json({ success: true, data: prefs });
  });

  // Update a user preference
  router.put('/preferences', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { category, channel, enabled } = req.body;
    if (!category || !channel || typeof enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'Fields category, channel, and enabled (boolean) are required'
      });
      return;
    }

    await service.getPreferencesStore().setPreference(userId, category, channel, enabled);
    res.json({ success: true, message: 'Preference updated successfully' });
  });

  return router;
}
