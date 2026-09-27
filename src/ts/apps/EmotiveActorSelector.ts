import { CONSTANTS } from "../constants";
import { getActorConfigs, getActorLimit, getConfirmFolderSync, getSelectorPreviewRows, saveActorFolders, setConfirmFolderSync, setPortraitExcluded, syncActorConfigs, updateActorConfig } from "../settings";
import { allHudActorUuids, DEFAULT_GROUP_ID, getHUDState, saveHUDState } from "../state";
import { HUDGroup } from '../types';
import { emitPortraitUpdated } from "../sockets";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PORTRAIT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export default class EmotiveActorSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  // unsaved group draft; written to hudstate on apply
  private groups: HUDGroup[] = [];
  // uuid -> portrait folder draft
  private folders: Record<string, string> = {};
  private dragDrop: foundry.applications.ux.DragDrop;
  private draggedItem: HTMLElement | null = null;
  // pointer distance from the dragged row's middle
  private grabOffset: number = 0;
  // uuids whose emote strip is open, kept across re-renders
  private expanded = new Set<string>();

  private readonly onDocumentMouseMove = (event: MouseEvent) => this._onDocumentMouseMove(event);
  private readonly onDocumentMouseUp = () => this._onDocumentMouseUp();

  static override DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2.DefaultOptions = {
    id: "expressive-actor-select",
    window: {
      title: "EMOTIVEHUD.emotive-actor-selector",
    },
    position: { width: 720, height: 720 },
  };

  static override PARTS = {
    main: { template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-actor-select.hbs` },
  };

  constructor(options = {}) {
    super(options);
    this._loadFromSettings();

    this.dragDrop = new foundry.applications.ux.DragDrop.implementation({
      dropSelector: ".drag-area",
      callbacks: { drop: this._onDragDrop.bind(this) }
    });
  }

  private _loadFromSettings(): void {
    const configs = getActorConfigs();
    this.groups = getHUDState().groups;
    this.folders = Object.fromEntries(
      allHudActorUuids({ groups: this.groups }).map(uuid => [uuid, configs[uuid]?.portraitFolder || ""])
    );
  }

  // fresh draft each open; the hud can reorder while closed
  open(): void {
    if (!this.rendered) this._loadFromSettings();
    this.render({ force: true });
  }

  private get allUuids(): string[] {
    return allHudActorUuids({ groups: this.groups });
  }

  private async _onDragDrop(event: DragEvent): Promise<void> {
    if (!event.dataTransfer) return;

    if (event.dataTransfer.files.length) {
      this._onDropFiles(event, Array.from(event.dataTransfer.files));
      return;
    }

    // drops land in the folder under the pointer
    const groupId = (event.target as HTMLElement).closest<HTMLElement>(".actor-group")?.dataset.groupId;

    try {
      const raw = event.dataTransfer.getData("text/plain");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.uuid) return;

      if (data.type === "Actor") {
        const actor = await fromUuid(data.uuid) as Actor | null;
        if (!actor) return;

        // pf2e party actors hold their characters in members
        const members = (actor as Actor & { members?: Actor[] }).members;
        if ((actor.type as string) === "party" && Array.isArray(members)) {
          const added = this._addActors(members.flatMap(m => m.uuid ?? []), groupId);
          if (!members.length) ui.notifications?.info(`${actor.name} has no members`);
          else if (added) ui.notifications?.info(`Added ${added} actor(s) from ${actor.name}`);
          return;
        }

        this._addActors([data.uuid], groupId);
      } else if (data.type === "Folder") {
        const folder = await fromUuid(data.uuid) as Folder | null;
        if (folder?.type !== "Actor") return;

        // getsubfolders(true) walks nested folders
        const folders = [folder, ...folder.getSubfolders(true)];
        const uuids = folders.flatMap(f => (f.contents as Actor[]).flatMap(doc => doc.uuid ?? []));
        if (!uuids.length) {
          ui.notifications?.info(`${folder.name} has no actors`);
          return;
        }

        const added = this._addActors(uuids, groupId);
        if (added) ui.notifications?.info(`Added ${added} actor(s) from ${folder.name}`);
      }
    } catch (err) {
      console.error(CONSTANTS.DEBUG_PREFIX, "Error processing drop:", err);
    }
  }

  // appends uuids not already listed, up to the actor limit; last group by default
  private _addActors(uuids: string[], groupId?: string): number {
    const actorLimit = getActorLimit();
    const configs = getActorConfigs();
    const listed = this.allUuids;
    const fresh = [...new Set(uuids)].filter(uuid => !listed.includes(uuid));
    const room = Math.max(0, actorLimit - listed.length);
    const toAdd = fresh.slice(0, room);

    if (fresh.length > toAdd.length) {
      const skipped = fresh.length - toAdd.length;
      ui.notifications?.warn(toAdd.length
        ? `Added ${toAdd.length} actor(s); ${skipped} skipped (limit of ${actorLimit} reached)`
        : `Cannot add more actors. Maximum limit of ${actorLimit} reached.`);
    }

    if (!toAdd.length) return 0;

    if (!this.groups.length) this.groups.push({ id: DEFAULT_GROUP_ID, actors: [] });
    const target = this.groups.find(group => group.id === groupId) ?? this.groups[this.groups.length - 1];
    for (const uuid of toAdd) {
      target.actors.push(uuid);
      this.folders[uuid] = configs[uuid]?.portraitFolder || "";
    }

    this.render();
    return toAdd.length;
  }

  // os file drops carry files but no text payload
  private _onDropFiles(event: DragEvent, files: File[]): void {
    const row = (event.target as HTMLElement).closest<HTMLElement>(".selected-actor");
    this.element.querySelectorAll(".file-drop-target").forEach(el => el.classList.remove("file-drop-target"));

    const uuid = row?.dataset.uuid;
    if (!uuid || !this.allUuids.includes(uuid)) {
      ui.notifications?.warn("Drop portraits onto an actor row");
      return;
    }

    const images = files.filter(file => this._isPortraitFile(file));
    if (images.length < files.length) {
      ui.notifications?.warn(`Skipped ${files.length - images.length} non-image file(s)`);
    }
    if (!images.length) return;

    this._uploadPortraits(uuid, images);
  }

  private async _onSelectPortraitFolder(event: MouseEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const uuid = target.dataset.uuid ?? '';
    if (!this.allUuids.includes(uuid)) return;

    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "folder",
      allowUpload: true,
      displayMode: "images",
      callback: async (path: string) => {
        try {
          this.folders[uuid] = path;
          this.render();
        } catch (error) {
          console.error(CONSTANTS.DEBUG_PREFIX, 'Error setting portrait folder:', error);
          ui.notifications?.error("Failed to set portrait folder");
        }
      },
    });
    fp.browse(this.folders[uuid] || "");
  }

  private async _onClickActorPortrait(event: MouseEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const actor = await fromUuid(target.dataset.uuid ?? '') as Actor;
    if (!actor) return;

    actor.sheet?.render(true);
  }

  private async _onRemoveActor(event: MouseEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const uuid = target.dataset.uuid;
    this.groups.forEach(group => group.actors = group.actors.filter(a => a !== uuid));
    if (uuid) delete this.folders[uuid];
    this.render();
  }

  // dialogv2.confirm resolves true on yes, false on no, null on close
  private async _onClearActors(event: MouseEvent): Promise<void> {
    event.preventDefault();
    if (!this.allUuids.length) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Clear All Actors" },
      content: "<p>Remove all actors from the list? Nothing is saved until you click Apply.</p>",
      rejectClose: false
    });
    if (!confirmed) return;

    this.groups = [];
    this.folders = {};
    this.expanded.clear();
    this.render();
  }

  private _onResetChanges(event: MouseEvent): void {
    event.preventDefault();
    this._loadFromSettings();
    this.render();
  }

  override async _prepareContext(_options: any): Promise<any> {
    const configs = getActorConfigs();

    const enrichActor = async (uuid: string) => {
      const actor = await fromUuid(uuid) as Actor;
      const currentPortrait = actor?.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait');
      const cached = configs[uuid]?.cachedPortraits ?? [];
      const excluded = new Set(configs[uuid]?.excludedPortraits ?? []);
      return {
        uuid,
        name: actor?.name,
        img: actor?.img,
        portraitFolder: this.folders[uuid] || "",
        expanded: this.expanded.has(uuid),
        portraits: cached.map(path => ({
          path,
          name: path.split('/').pop()?.split('.')[0] || 'Unknown',
          current: path === currentPortrait,
          excluded: excluded.has(path)
        }))
      };
    };

    const groups = await Promise.all(this.groups.map(async (group, index) => ({
      id: group.id,
      number: index + 1,
      actors: await Promise.all(group.actors.map(enrichActor)),
    })));

    return {
      groups,
      hasActors: this.allUuids.length > 0,
      canRemoveGroups: groups.length > 1,
      previewRows: getSelectorPreviewRows(),
    };
  }

  private _onToggleEmoteStrip(event: MouseEvent, target: HTMLElement): void {
    // clicks on the row's own controls keep their normal behavior
    if ((event.target as HTMLElement).closest("button, .drag-handle, .actor-portrait, .portrait-path")) return;

    const item = target.closest<HTMLElement>(".selected-actor");
    const uuid = item?.dataset.uuid;
    if (!item || !uuid) return;

    const isOpen = item.classList.toggle("expanded");
    if (isOpen) this.expanded.add(uuid);
    else this.expanded.delete(uuid);
  }

  private async _onSelectEmote(event: MouseEvent, itemEl: HTMLElement): Promise<void> {
    event.preventDefault();
    if (itemEl.classList.contains("excluded")) return;
    const path = itemEl.dataset.path;
    const uuid = itemEl.closest<HTMLElement>(".selected-actor")?.dataset.uuid;
    if (!path || !uuid) return;

    try {
      const actor = await fromUuid(uuid) as Actor;
      if (!actor?.id) throw new Error("Actor not found");

      await actor.setFlag(CONSTANTS.MODULE_ID, 'currentPortrait', path);
      emitPortraitUpdated(actor.id);

      itemEl.parentElement?.querySelectorAll(".emote-item").forEach(el => el.classList.toggle("current", el === itemEl));
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error updating portrait:', error);
      ui.notifications?.error("Failed to update portrait");
    }
  }

  // dialogv2.wait resolves with the clicked button's callback result, or null on close
  private async _confirmFolderSync(): Promise<boolean> {
    if (!getConfirmFolderSync()) return true;

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Sync Portrait Folder" },
      content: `
        <p>Syncing will rescan this folder and reset all excluded portraits for this actor.</p>
        <label><input type="checkbox" name="dontShow"> Don't show this again</label>
      `,
      buttons: [
        {
          action: "proceed",
          label: "Proceed",
          default: true,
          callback: (_event, button) => {
            const box = button.form?.elements.namedItem("dontShow") as HTMLInputElement | null;
            return box?.checked ? "proceed-hide" : "proceed";
          }
        },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });

    if (result === "proceed-hide") await setConfirmFolderSync(false);
    return result === "proceed" || result === "proceed-hide";
  }

  private async _onSyncPortraitFolder(event: MouseEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const uuid = target.dataset.uuid ?? '';
    const portraitFolder = this.folders[uuid];
    if (!portraitFolder) {
      ui.notifications?.warn("Select a portrait folder before syncing");
      return;
    }

    if (!(await this._confirmFolderSync())) return;

    try {
      await syncActorConfigs([{ uuid, portraitFolder }]);
      ui.notifications?.info("Portrait folder synced");
      this.render();
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error syncing portrait folder:', error);
      ui.notifications?.error("Failed to sync portrait folder");
    }
  }

  private async _onToggleExcluded(event: MouseEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const itemEl = target.closest<HTMLElement>(".emote-item");
    const path = itemEl?.dataset.path;
    const uuid = itemEl?.closest<HTMLElement>(".selected-actor")?.dataset.uuid;
    if (!itemEl || !path || !uuid) return;

    const exclude = !itemEl.classList.contains("excluded");

    try {
      await setPortraitExcluded(uuid, path, exclude);

      itemEl.classList.toggle("excluded", exclude);
      const button = itemEl.querySelector<HTMLElement>(".exclude-portrait");
      button?.setAttribute("title", exclude ? "Restore portrait" : "Exclude portrait");
      button?.querySelector("i")?.classList.toggle("fa-xmark", !exclude);
      button?.querySelector("i")?.classList.toggle("fa-rotate-left", exclude);

      // an excluded current emote falls back to the actor's default image
      if (exclude && itemEl.classList.contains("current")) {
        const actor = await fromUuid(uuid) as Actor;
        if (actor?.id) {
          await actor.unsetFlag(CONSTANTS.MODULE_ID, 'currentPortrait');
          emitPortraitUpdated(actor.id);
        }
        itemEl.classList.remove("current");
      }
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error excluding portrait:', error);
      ui.notifications?.error("Failed to update excluded portraits");
    }
  }

  override async _onRender(context: any, options: any): Promise<void> {
    await super._onRender(context, options);
    const on = (selector: string, type: string, handler: (event: any, target: HTMLElement) => unknown) => {
      this.element.querySelectorAll<HTMLElement>(selector).forEach(el => el.addEventListener(type, event => handler(event, el)));
    };

    on(".apply-button", "click", event => this._onClickApplyButton(event));
    on(".remove-actor", "click", (event, el) => this._onRemoveActor(event, el));
    on(".clear-actors", "click", event => this._onClearActors(event));
    on(".new-group", "click", event => this._onNewGroup(event));
    on(".remove-group", "click", (event, el) => this._onRemoveGroup(event, el));
    on(".reset-changes", "click", event => this._onResetChanges(event));
    on(".select-portrait-folder", "click", (event, el) => this._onSelectPortraitFolder(event, el));
    on(".import-portraits", "click", (event, el) => this._onImportPortraits(event, el));
    on(".sync-portrait-folder", "click", (event, el) => this._onSyncPortraitFolder(event, el));
    on(".actor-portrait.clickable", "click", (event, el) => this._onClickActorPortrait(event, el));
    on(".selected-actor .actor-row", "click", (event, el) => this._onToggleEmoteStrip(event, el));
    on(".emote-strip .emote-item", "click", (event, el) => this._onSelectEmote(event, el));
    on(".emote-strip .exclude-portrait", "click", (event, el) => this._onToggleExcluded(event, el));
    on(".selected-actor", "dragover", (event, el) => this._onRowFileDragOver(event, el));
    on(".selected-actor", "dragleave", (event, el) => this._onRowFileDragLeave(event, el));
    on(".drag-handle", "mousedown", (event, el) => this._onDragHandleMouseDown(event, el));

    this.dragDrop.bind(this.element);
  }

  // document listeners live only while the window is open
  override async _onFirstRender(context: any, options: any): Promise<void> {
    await super._onFirstRender(context, options);
    document.addEventListener("mousemove", this.onDocumentMouseMove);
    document.addEventListener("mouseup", this.onDocumentMouseUp);
  }

  override _onClose(options: any): void {
    super._onClose(options);
    document.removeEventListener("mousemove", this.onDocumentMouseMove);
    document.removeEventListener("mouseup", this.onDocumentMouseUp);
    this.draggedItem = null;
  }

  private async _onImportPortraits(event: MouseEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const uuid = target.dataset.uuid ?? '';
    if (!this.allUuids.includes(uuid)) return;

    // hidden file input opens the os file dialog
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = PORTRAIT_EXTENSIONS.join(',');

    input.onchange = async () => {
      if (!input.files?.length) return;
      await this._uploadPortraits(uuid, Array.from(input.files));
    };

    input.click();
  }

  private async _uploadPortraits(uuid: string, files: File[]): Promise<void> {
    const gameActor = await fromUuid(uuid) as Actor;
    if (!gameActor) return;

    try {
      let targetFolder = this.folders[uuid];
      if (!targetFolder) {
        const baseFolder = 'emotive-hud-portraits';
        const actorFolder = gameActor.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown_actor';
        targetFolder = `${baseFolder}/${actorFolder}`;

        // createdirectory throws when the folder already exists
        for (const folder of [baseFolder, targetFolder]) {
          try {
            await foundry.applications.apps.FilePicker.implementation.createDirectory('data', folder);
          } catch {
            // already exists
          }
        }

        this.folders[uuid] = targetFolder;
      }

      for (const file of files) {
        await foundry.applications.apps.FilePicker.implementation.upload('data', targetFolder, file);
      }

      await updateActorConfig(uuid, targetFolder);
      ui.notifications?.info(`Successfully imported ${files.length} portraits`);
      this.render();
    } catch (error) {
      console.error(`${CONSTANTS.DEBUG_PREFIX} Error uploading files:`, error);
      ui.notifications?.error("Failed to upload one or more portraits");
    }
  }

  private _isPortraitFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return PORTRAIT_EXTENSIONS.some(ext => name.endsWith(ext));
  }

  // browsers only allow a drop when dragover calls preventdefault
  private _onRowFileDragOver(event: DragEvent, row: HTMLElement): void {
    const types = event.dataTransfer?.types;
    if (!types || !Array.from(types).includes("Files")) return;
    event.preventDefault();
    row.classList.add("file-drop-target");
  }

  private _onRowFileDragLeave(event: DragEvent, row: HTMLElement): void {
    const related = event.relatedTarget as Node | null;
    if (related && row.contains(related)) return;
    row.classList.remove("file-drop-target");
  }

  private _onDragHandleMouseDown(event: MouseEvent, handle: HTMLElement): void {
    const item = handle.closest<HTMLElement>(".selected-actor");
    if (!item) return;

    const rect = item.getBoundingClientRect();
    this.draggedItem = item;
    this.grabOffset = event.clientY - (rect.top + rect.height / 2);

    item.classList.add("dragging");
    event.preventDefault();
  }

  // group list whose folder spans the pointer's height
  private _groupListAt(y: number): HTMLElement | null {
    const sections = Array.from(this.element.querySelectorAll<HTMLElement>(".actor-group"));
    const section = sections.find(s => {
      const rect = s.getBoundingClientRect();
      return y >= rect.top && y <= rect.bottom;
    });
    return section?.querySelector<HTMLElement>(".group-actors") ?? null;
  }

  // rows slot in before the first sibling whose middle sits below the dragged row
  private _onDocumentMouseMove(event: MouseEvent): void {
    const item = this.draggedItem;
    if (!item) return;

    const center = event.clientY - this.grabOffset;
    const from = item.parentElement as HTMLElement;
    const list = this._groupListAt(event.clientY) ?? from;

    const next = (Array.from(list.children) as HTMLElement[])
      .filter(sibling => sibling !== item)
      .find(sibling => {
        const rect = sibling.getBoundingClientRect();
        return center < rect.top + rect.height / 2;
      }) ?? null;

    if (item.parentElement !== list || item.nextElementSibling !== next) {
      list.insertBefore(item, next);
      from.classList.toggle("empty", !from.children.length);
      list.classList.remove("empty");
    }

    // translate from the row's new natural spot back under the pointer
    item.style.transform = "";
    const natural = item.getBoundingClientRect();
    item.style.transform = `translateY(${center - (natural.top + natural.height / 2)}px)`;
  }

  // dom order is the new draft; folders in order, rows within each
  private _onDocumentMouseUp(): void {
    if (!this.draggedItem) return;

    this.draggedItem.style.transform = "";
    this.draggedItem.classList.remove("dragging");
    this.draggedItem = null;

    const lists = Array.from(this.element.querySelectorAll<HTMLElement>(".group-actors"));
    this.groups = lists.map(list => ({
      id: list.dataset.groupId ?? "",
      actors: Array.from(list.querySelectorAll<HTMLElement>(":scope > .selected-actor")).map(row => row.dataset.uuid!),
    }));
    this.render();
  }

  private _onNewGroup(event: MouseEvent): void {
    event.preventDefault();
    this.groups.push({ id: foundry.utils.randomID(), actors: [] });
    this.render();
  }

  // actors fold into the group above, or below for the first one
  private _onRemoveGroup(event: MouseEvent, target: HTMLElement): void {
    event.preventDefault();
    const index = this.groups.findIndex(group => group.id === target.dataset.groupId);
    if (index < 0 || this.groups.length < 2) return;

    const [removed] = this.groups.splice(index, 1);
    const into = this.groups[Math.max(0, index - 1)];
    if (index === 0) into.actors.unshift(...removed.actors);
    else into.actors.push(...removed.actors);
    this.render();
  }

  private async _onClickApplyButton(event: Event): Promise<void> {
    event.preventDefault();
    
    try {
      // one settings write; unchanged folders skip the rescan
      await saveActorFolders(this.allUuids.map(uuid => ({ uuid, portraitFolder: this.folders[uuid] })));

      // world setting onchange re-renders every client
      await saveHUDState({ groups: this.groups });

      this.close();
      
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error saving changes:', error);
      ui.notifications?.error("Failed to save changes");
    }
  }
}
