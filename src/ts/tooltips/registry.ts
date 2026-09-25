import CONSTANTS from "../constants";
import { getTooltipFieldToggles } from "../settings";
import { TooltipField, TooltipSection } from "../types";
import { getGame } from "../utils";

export interface RegisteredField {
  // setting key, "systemid.fieldid"
  key: string;
  field: TooltipField;
}

const systemFields = new Map<string, Map<string, TooltipField>>();

const fieldKey = (systemId: string, id: string): string => `${systemId}.${id}`;

// public api; fields only show when the world runs that system
export const registerSystemFields = (systemId: string, fields: TooltipField[]): void => {
  const registry = systemFields.get(systemId) ?? new Map<string, TooltipField>();
  for (const field of fields) {
    if (registry.has(field.id)) console.warn(CONSTANTS.DEBUG_PREFIX, `tooltip field ${fieldKey(systemId, field.id)} replaced`);
    registry.set(field.id, field);
  }
  systemFields.set(systemId, registry);
};

// fields for the running system; empty when nothing registered for it
export const getSystemFields = (): RegisteredField[] => {
  const systemId = getGame().system?.id ?? "";
  return Array.from(systemFields.get(systemId)?.values() ?? [])
    .map(field => ({ key: fieldKey(systemId, field.id), field }));
};

export const isFieldEnabled = ({ key, field }: RegisteredField): boolean => {
  return getTooltipFieldToggles()[key] ?? field.defaultEnabled ?? true;
};

const toPercent = (value: number, max: number): number => {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(value / max * 100)));
};

// handlebars has no kind switch; flag each section with its kind
const prepareSection = (section: TooltipSection) => {
  const flags = { isBar: false, isIcons: false, isList: false, isTable: false };
  if (section.kind === "bar") {
    const temp = section.temp ?? 0;
    return {
      ...section, ...flags, isBar: true,
      pct: toPercent(section.value, section.max),
      tempPct: toPercent(temp, section.max),
      text: `${section.value}/${section.max}${temp > 0 ? ` (+${temp})` : ""}`,
    };
  }
  if (section.kind === "icons") return { ...section, ...flags, isIcons: true };
  if (section.kind === "list") return { ...section, ...flags, isList: true };
  if (section.kind === "table") return { ...section, ...flags, isTable: true };
  return { ...section, ...flags };
};

// null when no enabled field has anything to show
export const buildActorTooltip = async (actor: Actor): Promise<string | null> => {
  const sections: TooltipSection[] = [];

  for (const registered of getSystemFields()) {
    if (!isFieldEnabled(registered)) continue;
    try {
      const result = registered.field.render(actor);
      if (!result) continue;
      sections.push(...(Array.isArray(result) ? result : [result]));
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, `tooltip field ${registered.key} failed`, error);
    }
  }

  if (sections.length === 0) return null;

  return foundry.applications.handlebars.renderTemplate(`modules/${CONSTANTS.MODULE_ID}/templates/actor-tooltip.hbs`, {
    name: actor.name,
    stats: sections.filter(section => section.kind === "stat"),
    blocks: sections.filter(section => section.kind !== "stat").map(prepareSection),
  });
};
