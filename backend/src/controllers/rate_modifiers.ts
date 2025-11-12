import { getDatabase } from "../database/init.ts";
import { RateModifier } from "../types/index.ts";
import { generateUUID } from "../utils/uuid.ts";

const mapRowToRateModifier = (row: unknown[]): RateModifier => ({
  id: row[0] as string,
  name: row[1] as string,
  multiplier: Number(row[2]),
  description: (row[3] ?? undefined) as string | undefined,
  isDefault: Boolean(row[4]),
  createdAt: new Date(row[5] as string),
  updatedAt: new Date(row[6] as string),
});

export const getRateModifiers = (): RateModifier[] => {
  const db = getDatabase();
  const results = db.query(
    "SELECT id, name, multiplier, description, is_default, created_at, updated_at FROM rate_modifiers ORDER BY is_default DESC, name ASC",
  ) as unknown[][];
  return results.map((row) => mapRowToRateModifier(row));
};

export const getRateModifierById = (id: string): RateModifier | null => {
  const db = getDatabase();
  const results = db.query(
    "SELECT id, name, multiplier, description, is_default, created_at, updated_at FROM rate_modifiers WHERE id = ?",
    [id],
  ) as unknown[][];
  if (results.length === 0) return null;
  return mapRowToRateModifier(results[0]);
};

export const getDefaultRateModifier = (): RateModifier | null => {
  const db = getDatabase();
  const results = db.query(
    "SELECT id, name, multiplier, description, is_default, created_at, updated_at FROM rate_modifiers WHERE is_default = 1 LIMIT 1",
  ) as unknown[][];
  if (results.length === 0) return null;
  return mapRowToRateModifier(results[0]);
};

export const createRateModifier = (data: {
  name: string;
  multiplier: number;
  description?: string;
  isDefault?: boolean;
}): RateModifier => {
  const db = getDatabase();
  const id = generateUUID();
  const now = new Date();
  const isDefault = data.isDefault ?? false;

  // If setting as default, unset all other defaults first
  if (isDefault) {
    db.query("UPDATE rate_modifiers SET is_default = 0");
  }

  db.query(
    `INSERT INTO rate_modifiers (id, name, multiplier, description, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.multiplier,
      data.description ?? null,
      isDefault ? 1 : 0,
      now,
      now,
    ],
  );

  return {
    id,
    name: data.name,
    multiplier: data.multiplier,
    description: data.description,
    isDefault,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateRateModifier = (
  id: string,
  data: {
    name?: string;
    multiplier?: number;
    description?: string;
    isDefault?: boolean;
  },
): RateModifier | null => {
  const db = getDatabase();
  const existing = getRateModifierById(id);
  if (!existing) return null;

  const now = new Date();
  const name = data.name ?? existing.name;
  const multiplier = data.multiplier ?? existing.multiplier;
  const description = data.description !== undefined
    ? data.description
    : existing.description;
  const isDefault = data.isDefault !== undefined
    ? data.isDefault
    : existing.isDefault;

  // If setting as default, unset all other defaults first
  if (isDefault && !existing.isDefault) {
    db.query("UPDATE rate_modifiers SET is_default = 0");
  }

  db.query(
    `UPDATE rate_modifiers 
     SET name = ?, multiplier = ?, description = ?, is_default = ?, updated_at = ?
     WHERE id = ?`,
    [name, multiplier, description ?? null, isDefault ? 1 : 0, now, id],
  );

  return getRateModifierById(id);
};

export const deleteRateModifier = (id: string): void => {
  const db = getDatabase();
  const modifier = getRateModifierById(id);
  
  if (!modifier) {
    throw new Error("Rate modifier not found");
  }

  // Prevent deletion of the default rate modifier
  if (modifier.isDefault) {
    throw new Error(
      "Cannot delete the default rate modifier. Set another modifier as default first.",
    );
  }

  // Check if any invoice items are using this modifier
  const invoiceItems = db.query(
    "SELECT COUNT(*) as count FROM invoice_items WHERE rate_modifier_id = ?",
    [id],
  );
  const count = invoiceItems[0] ? Number(invoiceItems[0][0]) : 0;

  if (count > 0) {
    throw new Error(
      `Cannot delete rate modifier: ${count} invoice item(s) are using it.`,
    );
  }

  db.query("DELETE FROM rate_modifiers WHERE id = ?", [id]);
};
