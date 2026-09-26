export const PRODUCT_TABS = ['Tasks', 'Focus', 'Health', 'Budget'];
export const TASK_CATEGORIES = ['General','Study','Skills','Work','Homework','Office work','Home','Outgoing','Parties','Invitations','Travel','Personal'];
export function relatedCategory(category, title = '') {
  if (category && category !== 'General') return category;
  if (/\b(study|revise|revision|homework|exam|read|reading|hifz|murajah)\b/i.test(title)) return 'Study';
  if (/\b(work|office|meeting)\b/i.test(title)) return 'Work';
  if (/\b(skill|learn|practice|course)\b/i.test(title)) return 'Skills';
  if (/\b(travel|trip|packing)\b/i.test(title)) return 'Travel';
  return '';
}
export function matchingProducts(items, tab, category = '') {
  return items.filter(p => p.enabled && p.tabs.includes(tab) && (!category || p.categories.some(c => c.toLowerCase() === category.toLowerCase() || c === 'All')));
}
export function validateCatalog(items) {
  if (!Array.isArray(items) || items.length > 200) throw Error('Use at most 200 products.');
  const ids = new Set();
  const cleanText = (s, limit) => typeof s === 'string' && s.trim().length > 0 && s.length <= limit;
  const https = (s) => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
  return items.map(p => {
    if (!p || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) || ids.has(p.id)) throw Error('Each product needs a unique ID.');
    ids.add(p.id);
    if (!cleanText(p.name, 100) || !cleanText(p.url, 2000) || !https(p.url)) throw Error('Enter a product name and valid HTTPS product link.');
    if (!Array.isArray(p.tabs) || !p.tabs.length || p.tabs.some(t => !PRODUCT_TABS.includes(t))) throw Error('Select at least one supported tab.');
    if (!Array.isArray(p.categories) || !p.categories.length || p.categories.length > 20 || p.categories.some(c => !cleanText(c, 40))) throw Error('Enter 1–20 categories, separated by commas.');
    if (p.imageUrl && (p.imageUrl.length > 2000 || !https(p.imageUrl))) throw Error('Product image must be an HTTPS URL.');
    if (typeof p.enabled !== 'boolean') throw Error('Choose whether the product is visible.');
    return {id:p.id,name:p.name.trim(),url:p.url.trim(),tabs:[...new Set(p.tabs)],categories:[...new Set(p.categories.map(c=>c.trim()))],imageUrl:p.imageUrl || '',icon:typeof p.icon === 'string' ? p.icon.slice(0,12) : '🛍️',enabled:p.enabled};
  });
}
