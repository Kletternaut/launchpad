import type { Category, Tile, Bookmark } from '@/types';

const BASE='/api';
async function apiFetch<T>(path:string, options?:RequestInit):Promise<T>{
  const res=await fetch(`${BASE}${path}`,{headers:{'Content-Type':'application/json',...options?.headers},...options});
  if(!res.ok){let message=`API error: ${res.status}`;try{const body=await res.json();if(body?.error)message=body.error;}catch{}throw new Error(message);}
  return res.json();
}

export const api={
  getSettings:()=>apiFetch('/settings'), updateSettings:(data:unknown)=>apiFetch('/settings',{method:'PUT',body:JSON.stringify(data)}),
  getGroups:()=>apiFetch('/groups'), createGroup:(data:unknown)=>apiFetch('/groups',{method:'POST',body:JSON.stringify(data)}), updateGroup:(id:number,data:unknown)=>apiFetch(`/groups/${id}`,{method:'PUT',body:JSON.stringify(data)}), deleteGroup:(id:number)=>apiFetch(`/groups/${id}`,{method:'DELETE'}),
  getShortcuts:()=>apiFetch('/shortcuts'), createShortcut:(data:unknown)=>apiFetch('/shortcuts',{method:'POST',body:JSON.stringify(data)}), updateShortcut:(id:number,data:unknown)=>apiFetch(`/shortcuts/${id}`,{method:'PUT',body:JSON.stringify(data)}), deleteShortcut:(id:number)=>apiFetch(`/shortcuts/${id}`,{method:'DELETE'}), refreshFavicon:(id:number)=>apiFetch(`/shortcuts/${id}/refresh-favicon`,{method:'POST'}), removeIcon:(id:number)=>apiFetch(`/shortcuts/${id}/icon`,{method:'DELETE'}),
  getHierarchy:()=>apiFetch<{categories:Category[];tiles:Tile[];bookmarks:Bookmark[]}>('/hierarchy'),
  createCategory:(data:Partial<Category>)=>apiFetch<Category>('/categories',{method:'POST',body:JSON.stringify(data)}),
  updateCategory:(id:number,data:Partial<Category>)=>apiFetch<Category>(`/categories/${id}`,{method:'PUT',body:JSON.stringify(data)}),
  deleteCategory:(id:number)=>apiFetch<{ok:boolean}>(`/categories/${id}`,{method:'DELETE'}),
  createTile:(data:Partial<Tile>)=>apiFetch<Tile>('/tiles',{method:'POST',body:JSON.stringify(data)}),
  updateTile:(id:number,data:Partial<Tile>)=>apiFetch<Tile>(`/tiles/${id}`,{method:'PUT',body:JSON.stringify(data)}),
  deleteTile:(id:number)=>apiFetch<{ok:boolean}>(`/tiles/${id}`,{method:'DELETE'}),
  createBookmark:(data:Partial<Bookmark>)=>apiFetch<Bookmark>('/bookmarks',{method:'POST',body:JSON.stringify(data)}),
  updateBookmark:(id:number,data:Partial<Bookmark>)=>apiFetch<Bookmark>(`/bookmarks/${id}`,{method:'PUT',body:JSON.stringify(data)}),
  deleteBookmark:(id:number)=>apiFetch<{ok:boolean}>(`/bookmarks/${id}`,{method:'DELETE'}),
  updateHierarchyLayout:(data:{categories?:Pick<Category,'id'|'sort_order'>[];tiles?:Pick<Tile,'id'|'category_id'|'sort_order'|'position_x'|'position_y'>[];bookmarks?:Pick<Bookmark,'id'|'tile_id'|'sort_order'>[]})=>apiFetch<{ok:boolean}>('/hierarchy/layout',{method:'PUT',body:JSON.stringify(data)}),
  importBrave:(data:unknown)=>apiFetch<{ok:boolean;categoriesAdded:number;tilesAdded:number;bookmarksAdded:number;bookmarksUpdated:number}>('/hierarchy/import/brave',{method:'POST',body:JSON.stringify(data)}),
};
export type HierarchyApi={categories:Category[];tiles:Tile[];bookmarks:Bookmark[]};
