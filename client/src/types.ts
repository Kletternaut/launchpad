export interface Shortcut{id:number;title:string;url:string;icon_type:'favicon'|'manual';icon_path:string|null;favicon_cached:number;grid_x:number;grid_y:number;group_id:number|null;sort_order:number;created_at:string}
export interface Group{id:number;title:string;color:string;collapsed:number;grid_x:number;grid_y:number;grid_w:number;grid_h:number;sort_order:number;created_at:string}
export interface Category{id:number;name:string;sort_order:number;collapsed:number;created_at:string}
export interface Tile{id:number;category_id:number;name:string;sort_order:number;position_x:number|null;position_y:number|null;created_at:string}
export interface Bookmark{id:number;tile_id:number;name:string;url:string;favicon:string|null;sort_order:number;created_at:string}
export interface Settings{layout_mode:'row'|'column';column_extra_width:string;link_target:string;[key:string]:string}
