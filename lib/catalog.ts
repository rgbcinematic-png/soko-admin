import { prisma } from '@/lib/prisma';

/** "Téléviseur LED 43\"" → "televiseur-led-43" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = base || 'produit';
  let slug = root;
  for (let n = 2; n < 100; n++) {
    const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!clash || clash.id === ignoreId) return slug;
    slug = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

/** SK-P-2610-0001: product number within the month it was created. */
export async function nextProductRef(): Promise<string> {
  const now = new Date();
  const yymm = String(now.getUTCFullYear()).slice(2) + String(now.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `SK-P-${yymm}-`;
  const last = await prisma.product.findFirst({
    where: { ref: { startsWith: prefix } },
    orderBy: { ref: 'desc' },
    select: { ref: true },
  });
  const n = last ? Number(last.ref.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(4, '0');
}

export type CategoryOption = { id: string; label: string };

/** Categories for a dropdown: "Électroménager", then "Électroménager › Réfrigérateurs"… */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const all = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { nameFr: 'asc' }],
    select: { id: true, nameFr: true, parentId: true },
  });
  const out: CategoryOption[] = [];
  for (const top of all.filter((c) => !c.parentId)) {
    out.push({ id: top.id, label: top.nameFr });
    for (const child of all.filter((c) => c.parentId === top.id)) {
      out.push({ id: child.id, label: `${top.nameFr} › ${child.nameFr}` });
    }
  }
  return out;
}
