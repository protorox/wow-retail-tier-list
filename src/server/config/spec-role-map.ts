import { Role } from "@prisma/client";

const SPEC_ROLE_MAP: Record<string, Role> = {
  // DPS
  Arcane: Role.DPS,
  Fire: Role.DPS,
  Frost: Role.DPS,
  Affliction: Role.DPS,
  Demonology: Role.DPS,
  Destruction: Role.DPS,
  Assassination: Role.DPS,
  Outlaw: Role.DPS,
  Subtlety: Role.DPS,
  Marksmanship: Role.DPS,
  BeastMastery: Role.DPS,
  Survival: Role.DPS,
  Elemental: Role.DPS,
  Enhancement: Role.DPS,
  Retribution: Role.DPS,
  Shadow: Role.DPS,
  Devastation: Role.DPS,
  Augmentation: Role.DPS,
  Fury: Role.DPS,
  Arms: Role.DPS,
  Havoc: Role.DPS,
  Unholy: Role.DPS,
  FrostDK: Role.DPS,
  Windwalker: Role.DPS,
  Feral: Role.DPS,
  Balance: Role.DPS,

  // Tanks
  Protection: Role.TANK,
  ProtectionWarrior: Role.TANK,
  ProtectionPaladin: Role.TANK,
  Vengeance: Role.TANK,
  Blood: Role.TANK,
  Brewmaster: Role.TANK,
  Guardian: Role.TANK,

  // Healers
  Holy: Role.HEALER,
  HolyPaladin: Role.HEALER,
  Discipline: Role.HEALER,
  Mistweaver: Role.HEALER,
  Restoration: Role.HEALER,
  RestorationDruid: Role.HEALER,
  Preservation: Role.HEALER
};

export function getRoleForSpec(specName: string): Role | null {
  if (SPEC_ROLE_MAP[specName]) return SPEC_ROLE_MAP[specName];

  // Fallbacks for ambiguous names.
  if (specName === "Holy") return null;
  if (specName === "Restoration") return null;

  return null;
}
