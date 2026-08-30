export interface ShortcutRow {
  id: number;
  title: string;
  url: string;
  icon_type: 'favicon' | 'manual';
  icon_path: string | null;
  favicon_cached: number;
  grid_x: number;
  grid_y: number;
  grid_w?: number;
  grid_h?: number;
  group_id: number | null;
  sort_order: number;
  created_at: string;
}

export interface GroupRow {
  id: number;
  title: string;
  color: string;
  collapsed: number;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  sort_order: number;
  created_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  sort_order: number;
  collapsed: number;
  created_at: string;
}

export interface TileRow {
  id: number;
  category_id: number;
  name: string;
  sort_order: number;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
}

export interface BookmarkRow {
  id: number;
  tile_id: number;
  name: string;
  url: string;
  favicon: string | null;
  sort_order: number;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: string;
}

export type SqlParam = number | string | Uint8Array | null;
