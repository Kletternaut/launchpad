import { Router } from 'express';
import settings from './settings.js';
import groups from './groups.js';
import shortcuts from './shortcuts.js';
import hierarchy from './hierarchy.js';
import health from './health.js';
import data from './data.js';

const router = Router();

router.use(settings);
router.use(groups);
router.use(shortcuts);
router.use(hierarchy);
router.use(health);
router.use(data);

export default router;
