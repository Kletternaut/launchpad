import { Router, Request, Response } from 'express';
import { queryAll, queryOne, runInsert, runSql, transaction, execSql, saveDb } from '../db/index.js';
import type { CategoryRow, TileRow, BookmarkRow, SqlParam } from '../db/types.js';
import { parseBody, categoryCreate, categoryUpdate, tileCreate, tileUpdate, bookmarkCreate, bookmarkUpdate, hierarchyLayoutUpdate, braveImportPayload } from '../validation.js';

const router = Router();

function category(id: number) { return queryOne<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]); }
function tile(id: number) { return queryOne<TileRow>('SELECT * FROM tiles WHERE id = ?', [id]); }
function bookmark(id: number) { return queryOne<BookmarkRow>('SELECT * FROM bookmarks WHERE id = ?', [id]); }

router.get('/hierarchy', (_req, res) => {
  const categories = queryAll<CategoryRow>('SELECT * FROM categories ORDER BY sort_order, id');
  const tiles = queryAll<TileRow>('SELECT * FROM tiles ORDER BY category_id, sort_order, id');
  const bookmarks = queryAll<BookmarkRow>('SELECT * FROM bookmarks ORDER BY tile_id, sort_order, id');
  res.json({ categories, tiles, bookmarks });
});

router.post('/categories', (req: Request, res: Response) => {
  const parsed = parseBody(categoryCreate, req.body); if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { name, sort_order, collapsed } = parsed.data;
  const id = runInsert('INSERT INTO categories (name, sort_order, collapsed) VALUES (?, ?, ?)', [name, sort_order, collapsed]);
  res.status(201).json(category(id));
});

router.put('/categories/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id); const parsed = parseBody(categoryUpdate, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const fields: string[] = []; const values: SqlParam[] = [];
  for (const [col, value] of Object.entries(parsed.data)) { if (value !== undefined) { fields.push(`${col} = ?`); values.push(value); } }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id); runSql(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values); res.json(category(id));
});

router.delete('/categories/:id', (req, res) => { runSql('DELETE FROM categories WHERE id = ?', [Number(req.params.id)]); res.json({ ok: true }); });

router.post('/tiles', (req: Request, res: Response) => {
  const parsed = parseBody(tileCreate, req.body); if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { category_id, name, sort_order, position_x, position_y } = parsed.data;
  if (!category(category_id)) return res.status(404).json({ error: 'Category not found' });
  const id = runInsert('INSERT INTO tiles (category_id, name, sort_order, position_x, position_y) VALUES (?, ?, ?, ?, ?)', [category_id, name, sort_order, position_x, position_y]);
  res.status(201).json(tile(id));
});

router.put('/tiles/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id); const parsed = parseBody(tileUpdate, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  if (parsed.data.category_id !== undefined && !category(parsed.data.category_id)) return res.status(404).json({ error: 'Category not found' });
  const fields: string[] = []; const values: SqlParam[] = [];
  for (const [col, value] of Object.entries(parsed.data)) { if (value !== undefined) { fields.push(`${col} = ?`); values.push(value); } }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id); runSql(`UPDATE tiles SET ${fields.join(', ')} WHERE id = ?`, values); res.json(tile(id));
});

router.delete('/tiles/:id', (req, res) => { runSql('DELETE FROM tiles WHERE id = ?', [Number(req.params.id)]); res.json({ ok: true }); });

router.post('/bookmarks', (req: Request, res: Response) => {
  const parsed = parseBody(bookmarkCreate, req.body); if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { tile_id, name, url, favicon, sort_order } = parsed.data;
  if (!tile(tile_id)) return res.status(404).json({ error: 'Tile not found' });
  const id = runInsert('INSERT INTO bookmarks (tile_id, name, url, favicon, sort_order) VALUES (?, ?, ?, ?, ?)', [tile_id, name, url, favicon, sort_order]);
  res.status(201).json(bookmark(id));
});

router.put('/bookmarks/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id); const parsed = parseBody(bookmarkUpdate, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  if (parsed.data.tile_id !== undefined && !tile(parsed.data.tile_id)) return res.status(404).json({ error: 'Tile not found' });
  const fields: string[] = []; const values: SqlParam[] = [];
  for (const [col, value] of Object.entries(parsed.data)) { if (value !== undefined) { fields.push(`${col} = ?`); values.push(value); } }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id); runSql(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = ?`, values); res.json(bookmark(id));
});

router.delete('/bookmarks/:id', (req, res) => { runSql('DELETE FROM bookmarks WHERE id = ?', [Number(req.params.id)]); res.json({ ok: true }); });

router.put('/hierarchy/layout', (req: Request, res: Response) => {
  const parsed = parseBody(hierarchyLayoutUpdate, req.body); if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  transaction(() => {
    for (const c of parsed.data.categories ?? []) execSql('UPDATE categories SET sort_order = ? WHERE id = ?', [c.sort_order, c.id]);
    for (const t of parsed.data.tiles ?? []) execSql('UPDATE tiles SET category_id = ?, sort_order = ?, position_x = ?, position_y = ? WHERE id = ?', [t.category_id, t.sort_order, t.position_x, t.position_y, t.id]);
    for (const b of parsed.data.bookmarks ?? []) execSql('UPDATE bookmarks SET tile_id = ?, sort_order = ? WHERE id = ?', [b.tile_id, b.sort_order, b.id]);
  });
  res.json({ ok: true });
});

router.post('/hierarchy/import/brave', (req: Request, res: Response) => {
  const parsed = parseBody(braveImportPayload, req.body); if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { categories: incomingCategories } = parsed.data;
  let categoriesAdded = 0, tilesAdded = 0, bookmarksAdded = 0, bookmarksUpdated = 0;
  transaction(() => {
    const categoryIds = new Map<string, number>();
    const tileIds = new Map<string, number>();
    const existingBookmarks = new Map(queryAll<{ id: number; url: string }>('SELECT id, url FROM bookmarks').map(b => [b.url, b.id]));

    for (const inc of incomingCategories) {
      let cat = queryOne<CategoryRow>('SELECT * FROM categories WHERE name = ?', [inc.name]);
      if (!cat) { const id = runInsert('INSERT INTO categories (name, sort_order, collapsed) VALUES (?, ?, 0)', [inc.name, inc.sort_order]); cat = category(id)!; categoriesAdded++; }
      categoryIds.set(inc.name, cat.id);
      for (const incTile of inc.tiles) {
        let t = queryOne<TileRow>('SELECT * FROM tiles WHERE category_id = ? AND name = ?', [cat.id, incTile.name]);
        if (!t) { const id = runInsert('INSERT INTO tiles (category_id, name, sort_order, position_x, position_y) VALUES (?, ?, ?, NULL, NULL)', [cat.id, incTile.name, incTile.sort_order]); t = tile(id)!; tilesAdded++; }
        tileIds.set(`${cat.id}:${incTile.name}`, t.id);
        for (const incBookmark of incTile.bookmarks) {
          const existingId = existingBookmarks.get(incBookmark.url);
          if (existingId) { execSql('UPDATE bookmarks SET name = ?, favicon = ? WHERE id = ?', [incBookmark.name, incBookmark.favicon ?? null, existingId]); bookmarksUpdated++; }
          else { const id = runInsert('INSERT INTO bookmarks (tile_id, name, url, favicon, sort_order) VALUES (?, ?, ?, ?, ?)', [t.id, incBookmark.name, incBookmark.url, incBookmark.favicon ?? null, incBookmark.sort_order]); existingBookmarks.set(incBookmark.url, id); bookmarksAdded++; }
        }
      }
    }
  });
  saveDb();
  res.json({ ok: true, categoriesAdded, tilesAdded, bookmarksAdded, bookmarksUpdated });
});

export default router;
