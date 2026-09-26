import { TooltipSection } from "../../types";
import { registerSystemFields } from "../registry";

// no swade typings; actor shapes are read loosely
type SwadeActor = any;

// equipstatus: 0 stored, 1 carried, 2 off-hand, 3 equipped, 4 main hand, 5 two hands
const HELD_STATUSES = [2, 4, 5];
const WORN_STATUS = 3;

export const registerSwadeFields = (): void => {
  registerSystemFields("swade", [
    {
      id: "wounds",
      label: "Wounds",
      render: (actor: SwadeActor) => {
        const wounds = actor.system?.wounds;
        if (!wounds?.max || wounds.max <= 0) return null;
        return { kind: "bar", label: "Wounds", value: wounds.value ?? 0, max: wounds.max };
      },
    },
    {
      id: "fatigue",
      label: "Fatigue",
      render: (actor: SwadeActor) => {
        const fatigue = actor.system?.fatigue;
        if (!fatigue?.max || fatigue.max <= 0) return null;
        return { kind: "bar", label: "Fatigue", value: fatigue.value ?? 0, max: fatigue.max };
      },
    },
    {
      id: "toughness",
      label: "Toughness",
      render: (actor: SwadeActor) => {
        // toughness value already includes armor; the armor part shows in parens
        const toughness = actor.system?.stats?.toughness;
        if (toughness?.value == null) return null;
        const armor = toughness.armor ?? 0;
        return { kind: "stat", label: "Tough", value: armor > 0 ? `${toughness.value} (${armor})` : toughness.value };
      },
    },
    {
      id: "parry",
      label: "Parry",
      render: (actor: SwadeActor) => {
        const parry = actor.system?.stats?.parry?.value;
        return parry == null ? null : { kind: "stat", label: "Parry", value: parry };
      },
    },
    {
      id: "pace",
      label: "Pace",
      render: (actor: SwadeActor) => {
        // newer data models split pace by movement mode; older ones use stats.speed
        const pace = actor.system?.pace?.ground ?? actor.system?.stats?.speed?.value;
        return pace == null ? null : { kind: "stat", label: "Pace", value: pace };
      },
    },
    {
      id: "bennies",
      label: "Bennies",
      render: (actor: SwadeActor) => {
        // only wild cards get bennies
        const bennies = actor.system?.bennies;
        if (!actor.system?.wildcard || bennies?.value == null) return null;
        return { kind: "stat", label: "Bennies", value: bennies.max ? `${bennies.value}/${bennies.max}` : bennies.value };
      },
    },
    {
      id: "conviction",
      label: "Conviction",
      defaultEnabled: false,
      render: (actor: SwadeActor) => {
        // conviction is an optional setting rule
        const conviction = actor.system?.details?.conviction;
        if (conviction?.value == null) return null;
        return { kind: "stat", label: "Conviction", value: conviction.active ? `${conviction.value} (active)` : conviction.value };
      },
    },
    {
      id: "powerPoints",
      label: "Power Points",
      render: (actor: SwadeActor) => {
        // one pool per arcane background; general is the shared default
        const sections: TooltipSection[] = [];
        for (const [key, pool] of Object.entries<any>(actor.system?.powerPoints ?? {})) {
          if (!pool?.max || pool.max <= 0) continue;
          sections.push({ kind: "stat", label: key === "general" ? "PP" : `PP (${key})`, value: `${pool.value ?? 0}/${pool.max}` });
        }
        return sections.length ? sections : null;
      },
    },
    {
      id: "conditions",
      label: "Conditions",
      render: (actor: SwadeActor) => {
        // temporary effects cover status effects like shaken, distracted and vulnerable
        const effects: any[] = actor.temporaryEffects ?? [];
        const items = effects.map(effect => ({ img: effect.img, name: effect.name, badge: null }));
        return items.length ? { kind: "icons", label: "Conditions", items } : null;
      },
    },
    {
      id: "equipped",
      label: "Equipped",
      render: (actor: SwadeActor) => {
        const items: string[] = [];

        const armor: any[] = actor.itemTypes?.armor ?? [];
        armor
          .filter(item => item.system?.equipStatus === WORN_STATUS)
          .forEach(item => items.push(item.name));

        const weapons: any[] = actor.itemTypes?.weapon ?? [];
        weapons
          .filter(item => HELD_STATUSES.includes(item.system?.equipStatus))
          .forEach(item => items.push(item.name));

        // shield parry is the bonus it adds to the parry stat
        const shields: any[] = actor.itemTypes?.shield ?? [];
        shields
          .filter(item => item.system?.equipStatus === WORN_STATUS)
          .forEach(item => {
            const parry = item.system?.parry ?? 0;
            items.push(parry > 0 ? `${item.name} (+${parry})` : item.name);
          });

        return items.length ? { kind: "list", label: "Equipped", items } : null;
      },
    },
  ]);
};
