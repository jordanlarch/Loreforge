/**
 * Curated level-1 starting equipment packs for the Creation Wizard (CHAR-4).
 *
 * Stub packs until full SRD class/background equipment ingest (INFRA-6).
 * One default loadout per core class — enough to enter Live Play with weapons
 * and armor equipped.
 */
import type { EquipmentItem } from "@/lib/character";

export type StartingPack = {
  label: string;
  items: EquipmentItem[];
  /** Base AC after equipping this pack (5E armor rules, pre-magic). */
  baseAc: number;
};

function pack(
  label: string,
  baseAc: number,
  items: Omit<EquipmentItem, "equipped">[],
): StartingPack {
  return {
    label,
    baseAc,
    items: items.map((item) => ({
      ...item,
      equipped: item.slot === "armor" || item.slot === "weapon" || item.slot === "shield",
    })),
  };
}

/** Default starting pack per SRD class slug. */
export const STARTING_PACKS: Record<string, StartingPack> = {
  barbarian: pack("Explorer's pack — greataxe & javelins", 12, [
    { name: "Greataxe", quantity: 1, slot: "weapon" },
    { name: "Handaxe", quantity: 2, slot: "weapon" },
    { name: "Explorer's Pack", quantity: 1, slot: "pack" },
    { name: "Javelin", quantity: 4, slot: "weapon" },
  ]),
  bard: pack("Entertainer's pack — rapier & lute", 13, [
    { name: "Rapier", quantity: 1, slot: "weapon" },
    { name: "Leather Armor", quantity: 1, slot: "armor" },
    { name: "Dagger", quantity: 1, slot: "weapon" },
    { name: "Entertainer's Pack", quantity: 1, slot: "pack" },
    { name: "Lute", quantity: 1, slot: "tool" },
  ]),
  cleric: pack("Priest's pack — mace, scale mail & shield", 18, [
    { name: "Mace", quantity: 1, slot: "weapon" },
    { name: "Scale Mail", quantity: 1, slot: "armor" },
    { name: "Shield", quantity: 1, slot: "shield" },
    { name: "Light Crossbow", quantity: 1, slot: "weapon" },
    { name: "Crossbow Bolts", quantity: 20, slot: "ammo" },
    { name: "Priest's Pack", quantity: 1, slot: "pack" },
  ]),
  druid: pack("Explorer's pack — scimitar & leather", 13, [
    { name: "Scimitar", quantity: 1, slot: "weapon" },
    { name: "Leather Armor", quantity: 1, slot: "armor" },
    { name: "Shield", quantity: 1, slot: "shield" },
    { name: "Explorer's Pack", quantity: 1, slot: "pack" },
  ]),
  fighter: pack("Chain mail & shield — longsword", 18, [
    { name: "Longsword", quantity: 1, slot: "weapon" },
    { name: "Chain Mail", quantity: 1, slot: "armor" },
    { name: "Shield", quantity: 1, slot: "shield" },
    { name: "Light Crossbow", quantity: 1, slot: "weapon" },
    { name: "Crossbow Bolts", quantity: 20, slot: "ammo" },
    { name: "Dungeoneer's Pack", quantity: 1, slot: "pack" },
  ]),
  monk: pack("Explorer's pack — shortsword & darts", 12, [
    { name: "Shortsword", quantity: 1, slot: "weapon" },
    { name: "Dart", quantity: 10, slot: "weapon" },
    { name: "Explorer's Pack", quantity: 1, slot: "pack" },
  ]),
  paladin: pack("Chain mail & shield — longsword", 18, [
    { name: "Longsword", quantity: 1, slot: "weapon" },
    { name: "Chain Mail", quantity: 1, slot: "armor" },
    { name: "Shield", quantity: 1, slot: "shield" },
    { name: "Javelin", quantity: 5, slot: "weapon" },
    { name: "Priest's Pack", quantity: 1, slot: "pack" },
  ]),
  ranger: pack("Explorer's pack — longbow & shortswords", 14, [
    { name: "Longbow", quantity: 1, slot: "weapon" },
    { name: "Arrows", quantity: 20, slot: "ammo" },
    { name: "Shortsword", quantity: 2, slot: "weapon" },
    { name: "Leather Armor", quantity: 1, slot: "armor" },
    { name: "Explorer's Pack", quantity: 1, slot: "pack" },
  ]),
  rogue: pack("Burglar's pack — rapier & leather", 13, [
    { name: "Rapier", quantity: 1, slot: "weapon" },
    { name: "Shortbow", quantity: 1, slot: "weapon" },
    { name: "Arrows", quantity: 20, slot: "ammo" },
    { name: "Leather Armor", quantity: 1, slot: "armor" },
    { name: "Dagger", quantity: 2, slot: "weapon" },
    { name: "Burglar's Pack", quantity: 1, slot: "pack" },
  ]),
  sorcerer: pack("Explorer's pack — light crossbow & arcane focus", 10, [
    { name: "Light Crossbow", quantity: 1, slot: "weapon" },
    { name: "Crossbow Bolts", quantity: 20, slot: "ammo" },
    { name: "Arcane Focus", quantity: 1, slot: "focus" },
    { name: "Dagger", quantity: 2, slot: "weapon" },
    { name: "Explorer's Pack", quantity: 1, slot: "pack" },
  ]),
  warlock: pack("Scholar's pack — light crossbow & arcane focus", 11, [
    { name: "Light Crossbow", quantity: 1, slot: "weapon" },
    { name: "Crossbow Bolts", quantity: 20, slot: "ammo" },
    { name: "Arcane Focus", quantity: 1, slot: "focus" },
    { name: "Leather Armor", quantity: 1, slot: "armor" },
    { name: "Dagger", quantity: 2, slot: "weapon" },
    { name: "Scholar's Pack", quantity: 1, slot: "pack" },
  ]),
  wizard: pack("Scholar's pack — quarterstaff & arcane focus", 10, [
    { name: "Quarterstaff", quantity: 1, slot: "weapon" },
    { name: "Arcane Focus", quantity: 1, slot: "focus" },
    { name: "Dagger", quantity: 1, slot: "weapon" },
    { name: "Scholar's Pack", quantity: 1, slot: "pack" },
  ]),
};

/** Resolve the default pack for a class slug, or a bare unarmored fallback. */
export function startingPackForClass(classSlug: string): StartingPack {
  return (
    STARTING_PACKS[classSlug] ?? {
      label: "Adventurer's kit",
      baseAc: 10,
      items: [
        { name: "Dagger", quantity: 1, equipped: true, slot: "weapon" },
        { name: "Explorer's Pack", quantity: 1, equipped: false, slot: "pack" },
      ],
    }
  );
}
