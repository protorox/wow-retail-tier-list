export const CLASS_COLORS: Record<string, string> = {
  DeathKnight: "#C41F3B",
  "Death Knight": "#C41F3B",
  DemonHunter: "#A330C9",
  "Demon Hunter": "#A330C9",
  Druid: "#FF7D0A",
  Evoker: "#33937F",
  Hunter: "#ABD473",
  Mage: "#40C7EB",
  Monk: "#00FF96",
  Paladin: "#F58CBA",
  Priest: "#FFFFFF",
  Rogue: "#FFF569",
  Shaman: "#0070DE",
  Warlock: "#8788EE",
  Warrior: "#C79C6E"
};

export function resolveClassColor(className: string): string {
  return CLASS_COLORS[className] ?? "#475569";
}
