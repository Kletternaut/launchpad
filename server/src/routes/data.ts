import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { queryAll, execSql, transaction } from '../db/index.js';
import type { GroupRow, SettingRow, ShortcutRow, CategoryRow, TileRow, BookmarkRow } from '../db/types.js';
import { config } from '../config.js';
import { parseBody, importPayload } from '../validation.js';

const router = Router();
const ICONS_DIR = config.iconsDir;

router.get('/export', (_req: Request, res: Response) => {
  const settings = queryAll<SettingRow>('SELECT key, value FROM settings');
  const groups = queryAll<GroupRow>('SELECT * FROM groups ORDER BY sort_order, id');
  const shortcuts = queryAll<ShortcutRow>('SELECT * FROM shortcuts ORDER BY sort_order, id');
  const categories = queryAll<CategoryRow>('SELECT * FROM categories ORDER BY sort_order, id');
  const tiles = queryAll<TileRow>('SELECT * FROM tiles ORDER BY category_id, sort_order, id');
  const bookmarks = queryAll<BookmarkRow>('SELECT * FROM bookmarks ORDER BY tile_id, sort_order, id');

  const icons: Record<string, string> = {};
  for (const sc of shortcuts) {
    if (sc.icon_path) {
      const iconFile = path.join(ICONS_DIR, sc.icon_path);
      if (fs.existsSync(iconFile)) icons[sc.icon_path] = fs.readFileSync(iconFile).toString('base64');
    }
  }

  res.json({ settings, groups, shortcuts, categories, tiles, bookmarks, icons });
});

router.post('/import', (req: Request, res: Response) => {
  const parsed = parseBody(importPayload, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { settings = [], groups = [], shortcuts = [], categories = [], tiles = [], bookmarks = [], icons = {} } = parsed.data;

  transaction(() => {
    execSql('DELETE FROM bookmarks'); execSql('DELETE FROM tiles'); execSql('DELETE FROM categories');
    execSql('DELETE FROM shortcuts'); execSql('DELETE FROM groups'); execSql('DELETE FROM settings');
    for (const s of settings) execSql('INSERT INTO settings (key,value) VALUES (?,?)',[s.key,s.value]);
    for (const g of groups) execSql('INSERT INTO groups (id,title,color,collapsed,grid_x,grid_y,grid_w,grid_h,sort_order) VALUES (?,?,?,?,?,?,?,?,?)',[g.id,g.title,g.color,g.collapsed,g.grid_x,g.grid_y,g.grid_w,g.grid_h,g.sort_order]);
    for (const s of shortcuts) execSql('INSERT INTO shortcuts (id,title,url,icon_type,icon_path,favicon_cached,grid_x,grid_y,group_id,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',[s.id,s.title,s.url,s.icon_type,s.icon_path,s.favicon_cached,s.grid_x,s.grid_y,s.group_id,s.sort_order]);
    for (const c of categories) execSql('INSERT INTO categories (id,name,sort_order,collapsed) VALUES (?,?,?,?)',[c.id,c.name,c.sort_order,c.collapsed]);
    for (const t of tiles) execSql('INSERT INTO tiles (id,category_id,name,sort_order,position_x,position_y) VALUES (?,?,?,?,?,?)',[t.id,t.category_id,t.name,t.sort_order,t.position_x,t.position_y]);
    for (const b of bookmarks) execSql('INSERT INTO bookmarks (id,tile_id,name,url,favicon,sort_order) VALUES (?,?,?,?,?,?)',[b.id,b.tile_id,b.name,b.url,b.favicon,b.sort_order]);
  });

  if (fs.existsSync(ICONS_DIR)) for (const file of fs.readdirSync(ICONS_DIR)) fs.unlinkSync(path.join(ICONS_DIR,file));
  for (const [filename,base64] of Object.entries(icons)) fs.writeFileSync(path.join(ICONS_DIR,filename),Buffer.from(base64,'base64'));
  res.json({ok:true});
});

export default router;
