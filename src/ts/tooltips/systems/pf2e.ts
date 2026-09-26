import { TooltipSection } from "../../types";
import { registerSystemFields } from "../registry";

// no pf2e typings; actor shapes are read loosely
type PF2eActor = any;

const MAX_SPELL_RANK = 10;

interface SlotData {
  value?: number;
  max?: number;
  // prepared casters list the spell in each slot; expended marks it cast
  prepared?: { id: string | null; expended?: boolean }[] | Record<string, { id: string | null; expended?: boolean }>;
}

// x/y per rank for one spellcasting entry; null when it has no leveled slots
const readSlots = (entry: any): { columns: string[]; row: string[] } | null => {
  const mode = entry.system?.prepared?.value;
  const flexible = !!entry.system?.prepared?.flexible;
  if (mode !== "prepared" && mode !== "spontaneous") return null;

  const columns: string[] = [];
  const row: string[] = [];

  // slot0 is cantrips; they never run out
  for (let rank = 1; rank <= MAX_SPELL_RANK; rank++) {
    const slot: SlotData | undefined = entry.system?.slots?.[`slot${rank}`];
    if (!slot) continue;

    let remaining: number;
    let total: number;
    if (mode === "spontaneous" || flexible) {
      remaining = slot.value ?? 0;
      total = slot.max ?? 0;
    } else {
      const prepared = Object.values(slot.prepared ?? {}).filter(p => p?.id);
      remaining = prepared.filter(p => !p.expended).length;
      total = prepared.length;
    }

    if (total <= 0) continue;
    columns.push(`${rank}`);
    row.push(`${remaining}/${total}`);
  }

  return columns.length ? { columns, row } : null;
};

export const registerPF2eFields = (): void => {
  registerSystemFields("pf2e", [
    {
      id: "hp",
      label: "Hit Points",
      render: (actor: PF2eActor) => {
        const hp = actor.system?.attributes?.hp;
        if (!hp?.max) return null;
        return { kind: "bar", label: "HP", value: hp.value ?? 0, max: hp.max, temp: hp.temp ?? 0 };
      },
    },
    {
      id: "ac",
      label: "Armor Class",
      render: (actor: PF2eActor) => {
        const ac = actor.armorClass?.value ?? actor.system?.attributes?.ac?.value;
        return ac == null ? null : { kind: "stat", label: "AC", value: ac };
      },
    },
    {
      id: "focus",
      label: "Focus Points",
      render: (actor: PF2eActor) => {
        const focus = actor.system?.resources?.focus;
        if (!focus?.max) return null;
        return { kind: "stat", label: "Focus", value: `${focus.value ?? 0}/${focus.max}` };
      },
    },
    {
      id: "resources",
      label: "Class Resources",
      render: (actor: PF2eActor) => {
        // specialresource rule elements land in synthetics.resources keyed by slug, e.g. versatile vials
        const sections: TooltipSection[] = [];
        for (const [slug, rule] of Object.entries<any>(actor.synthetics?.resources ?? {})) {
          const resource = actor.getResource?.(slug) ?? rule;
          if (!resource?.max) continue;
          sections.push({ kind: "stat", label: resource.label ?? rule.label ?? slug, value: `${resource.value ?? 0}/${resource.max}` });
        }
        return sections.length ? sections : null;
      },
    },
    {
      id: "heroPoints",
      label: "Hero Points",
      render: (actor: PF2eActor) => {
        const hero = actor.system?.resources?.heroPoints;
        if (!hero?.max) return null;
        return { kind: "stat", label: "Hero", value: `${hero.value ?? 0}/${hero.max}` };
      },
    },
    {
      id: "infusedReagents",
      label: "Infused Reagents",
      render: (actor: PF2eActor) => {
        // daily alchemist crafting pool on the crafting tab
        const reagents = actor.system?.resources?.crafting?.infusedReagents;
        if (!reagents?.max) return null;
        return { kind: "stat", label: "Reagents", value: `${reagents.value ?? 0}/${reagents.max}` };
      },
    },
    {
      id: "conditions",
      label: "Conditions",
      render: (actor: PF2eActor) => {
        // conditions are items; value is the number on valued ones like frightened 2
        const conditions: any[] = actor.itemTypes?.condition ?? [];
        const items = conditions
          .filter(condition => condition.active !== false)
          .map(condition => ({ img: condition.img, name: condition.name, badge: condition.value ?? null }));
        return items.length ? { kind: "icons", label: "Conditions", items } : null;
      },
    },
    {
      id: "effects",
      label: "Effects",
      render: (actor: PF2eActor) => {
        // effect badges are counters or formula results; only numbers are worth showing
        const effects: any[] = actor.itemTypes?.effect ?? [];
        const items = effects.map(effect => {
          const badge = effect.badge?.value;
          return { img: effect.img, name: effect.name, badge: typeof badge === "number" ? badge : null };
        });
        return items.length ? { kind: "icons", label: "Effects", items } : null;
      },
    },
    {
      id: "equipped",
      label: "Equipped",
      render: (actor: PF2eActor) => {
        const items: string[] = [];

        const armor = actor.wornArmor;
        if (armor) items.push(armor.name);

        // a held weapon is equipped with carrytype held
        const weapons: any[] = actor.itemTypes?.weapon ?? [];
        weapons
          .filter(weapon => weapon.isEquipped && weapon.system?.equipped?.carryType === "held")
          .forEach(weapon => items.push(weapon.name));

        const shield = actor.heldShield;
        if (shield) {
          const hp = shield.system?.hp;
          items.push(hp?.max ? `${shield.name} (${hp.value}/${hp.max})` : shield.name);
        }

        return items.length ? { kind: "list", label: "Equipped", items } : null;
      },
    },
    {
      id: "spellSlots",
      label: "Spell Slots",
      render: (actor: PF2eActor) => {
        const entries: any[] = actor.itemTypes?.spellcastingEntry ?? [];
        const sections: TooltipSection[] = [];
        for (const entry of entries) {
          const slots = readSlots(entry);
          if (slots) sections.push({ kind: "table", label: entry.name, columns: slots.columns, rows: [slots.row] });
        }
        return sections.length ? sections : null;
      },
    },
  ]);
};
