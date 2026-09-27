import { CONSTANTS } from "../constants";
import { getActorConfigs, getActorLimit, getConfirmFolderSync, getSelectorPreviewRows, saveActorFolders, setConfirmFolderSync, setPortraitExcluded, syncActorConfigs, updateActorConfig } from "../settings";
import { allHudActorUuids, DEFAULT_GROUP_ID, getHUDState, saveHUDState } from "../state";
import { HUDGroup } from '../types';
import { emitPortraitUpdated } from "../sockets";
import { getGame } from "../utils";

const PORTRAIT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export default class EmotiveActorSelector extends Application {
  // unsaved group draft; written to hudstate on apply
  private groups: HUDGroup[] = [];
  // uuid -> portrait folder draft
  private folders: Record<string, string> = {};
  protected override _dragDrop: DragDrop[] = [];
  private draggedItem: HTMLElement | null = null;
  // pointer distance from the dragged row's middle
  private grabOffset: number = 0;
  // uuids whose emote strip is open, kept across re-renders
  private expanded = new Set<string>();

  constructor(options = {}) {
    super(options);

    // load up settings data
    this._loadFromSettings();

    this._dragDrop = [
      new DragDrop({
        dragSelector: ".actor-item",
        dropSelector: ".drag-area",
        permissions: {
          dragstart: (selector: DragDrop.DragSelector) => this._canDragStart(selector),
          drop: (selector: DragDrop.DragSelector) => this._canDragDrop(selector)
        },
        callbacks: {
          dragstart: this._onDragStart.bind(this),
          drop: this._onDragDrop.bind(this)
        }
      })
    ];
  }

  private async _loadFromSettings(): Promise<void> {
    const configs = getActorConfigs();
    this.groups = getHUDState().groups;
    this.folders = Object.fromEntries(
      allHudActorUuids({ groups: this.groups }).map(uuid => [uuid, configs[uuid]?.portraitFolder || ""])
    );
  }

  // fresh draft each open; the hud can reorder while closed
  open(): void {
    if (!this.rendered) this._loadFromSettings();
    this.render(true);
  }

  private get allUuids(): string[] {
    return allHudActorUuids({ groups: this.groups });
  }

  protected override _canDragStart(selector: DragDrop.DragSelector): boolean {
    if (!selector) return false;
    return true;
  }
  
  protected override _canDragDrop(selector: DragDrop.DragSelector): boolean {
    if (!selector) return false;
    return true;
  }

  protected override _onDragStart(event: DragEvent): void {
    if (!event.dataTransfer) return;
    
    const target = event.currentTarget as HTMLElement;
    if (!target?.dataset?.actorId) return;

    const actorId = target.dataset.actorId;
    
    console.log(CONSTANTS.DEBUG_PREFIX, "Actor selected for drag:", actorId);
    
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "Actor",
      id: actorId
    }));
  }

  protected async _onDragDrop(event: DragEvent): Promise<void> {
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

    this.render(false);
    return toAdd.length;
  }

  // os file drops carry files but no text payload
  private _onDropFiles(event: DragEvent, files: File[]): void {
    const row = (event.target as HTMLElement).closest<HTMLElement>(".selected-actor");
    this.element.find(".file-drop-target").removeClass("file-drop-target");

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

  private async _onSelectPortraitFolder(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid') as string;
    if (!this.allUuids.includes(uuid)) return;

    const fp = new FilePicker({
      type: "folder",
      allowUpload: true,
      displayMode: "images",
      callback: async (path: string) => {
        try {
          this.folders[uuid] = path;
          this.render(true);
        } catch (error) {
          console.error(CONSTANTS.DEBUG_PREFIX, 'Error setting portrait folder:', error);
          ui.notifications?.error("Failed to set portrait folder");
        }
      },
    });
    fp.browse(this.folders[uuid] || "");
  }

  private async _onClickActorPortrait(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    const actor = await fromUuid(uuid) as Actor;
    if (!actor) return;

    actor.sheet?.render(true);
  }

  private async _onRemoveActor(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    this.groups.forEach(group => group.actors = group.actors.filter(a => a !== uuid));
    delete this.folders[uuid];
    this.render(false);
  }

  // dialogv2.confirm resolves true on yes, false on no, null on close
  private async _onClearActors(event: JQuery.ClickEvent): Promise<void> {
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
    this.render(false);
  }

  override get title(): string {
    return getGame().i18n!.localize("EMOTIVEHUD.emotive-actor-selector");
  }

  static override get defaultOptions(): Application.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "expressive-actor-select",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-actor-select.hbs`,
      width: 720,
      height: 720,
    }) as Application.Options;
  }

  private async _onResetChanges(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    await this._loadFromSettings();
    this.render(false);
  }

  override async getData() {
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

  private _onToggleEmoteStrip(event: JQuery.ClickEvent): void {
    // clicks on the row's own controls keep their normal behavior
    if ($(event.target).closest("button, .drag-handle, .actor-portrait, .portrait-path").length) return;

    const item = $(event.currentTarget).closest(".selected-actor");
    const uuid = item.data("uuid") as string;
    if (!uuid) return;

    const isOpen = item.toggleClass("expanded").hasClass("expanded");
    if (isOpen) this.expanded.add(uuid);
    else this.expanded.delete(uuid);
  }

  private async _onSelectEmote(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const itemEl = $(event.currentTarget);
    if (itemEl.hasClass("excluded")) return;
    const path = itemEl.data("path") as string;
    const uuid = itemEl.closest(".selected-actor").data("uuid") as string;
    if (!path || !uuid) return;

    try {
      const actor = await fromUuid(uuid) as Actor;
      if (!actor?.id) throw new Error("Actor not found");

      await actor.setFlag(CONSTANTS.MODULE_ID, 'currentPortrait', path);
      emitPortraitUpdated(actor.id);

      itemEl.siblings(".emote-item").removeClass("current");
      itemEl.addClass("current");
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

  private async _onSyncPortraitFolder(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid') as string;
    const portraitFolder = this.folders[uuid];
    if (!portraitFolder) {
      ui.notifications?.warn("Select a portrait folder before syncing");
      return;
    }

    if (!(await this._confirmFolderSync())) return;

    try {
      await syncActorConfigs([{ uuid, portraitFolder }]);
      ui.notifications?.info("Portrait folder synced");
      this.render(false);
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error syncing portrait folder:', error);
      ui.notifications?.error("Failed to sync portrait folder");
    }
  }

  private async _onToggleExcluded(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const itemEl = $(event.currentTarget).closest(".emote-item");
    const path = itemEl.data("path") as string;
    const uuid = itemEl.closest(".selected-actor").data("uuid") as string;
    if (!path || !uuid) return;

    const exclude = !itemEl.hasClass("excluded");

    try {
      await setPortraitExcluded(uuid, path, exclude);

      itemEl.toggleClass("excluded", exclude);
      itemEl.find(".exclude-portrait")
        .attr("title", exclude ? "Restore portrait" : "Exclude portrait")
        .find("i")
        .toggleClass("fa-xmark", !exclude)
        .toggleClass("fa-rotate-left", exclude);

      // an excluded current emote falls back to the actor's default image
      if (exclude && itemEl.hasClass("current")) {
        const actor = await fromUuid(uuid) as Actor;
        if (actor?.id) {
          await actor.unsetFlag(CONSTANTS.MODULE_ID, 'currentPortrait');
          emitPortraitUpdated(actor.id);
        }
        itemEl.removeClass("current");
      }
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error excluding portrait:', error);
      ui.notifications?.error("Failed to update excluded portraits");
    }
  }

  override activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html);
    
    html.find(".apply-button")
      .on("click", this._onClickApplyButton.bind(this));
        
    html.find(".remove-actor")
      .on("click", this._onRemoveActor.bind(this));

    html.find(".clear-actors")
      .on("click", this._onClearActors.bind(this));

    html.find(".new-group")
      .on("click", this._onNewGroup.bind(this));

    html.find(".remove-group")
      .on("click", this._onRemoveGroup.bind(this));

    html.find(".reset-changes")
      .on("click", this._onResetChanges.bind(this));

    html.find(".select-portrait-folder")
      .on("click", this._onSelectPortraitFolder.bind(this));

    html.find
      (".import-portraits").on("click", this._onImportPortraits.bind(this));

    html.find(".sync-portrait-folder")
      .on("click", this._onSyncPortraitFolder.bind(this));
      
    html.find(".actor-portrait.clickable")
      .on("click", this._onClickActorPortrait.bind(this));

    html.find(".selected-actor .actor-row")
      .on("click", this._onToggleEmoteStrip.bind(this));

    html.find(".emote-strip .emote-item")
      .on("click", this._onSelectEmote.bind(this));

    html.find(".emote-strip .exclude-portrait")
      .on("click", this._onToggleExcluded.bind(this));

    html.find(".selected-actor")
      .on("dragover", this._onRowFileDragOver.bind(this))
      .on("dragleave", this._onRowFileDragLeave.bind(this));

    const dragHandles = html.find(".drag-handle");
    dragHandles.on("mousedown", this._onDragHandleMouseDown.bind(this));
    
    // namespaced so each render replaces the old document handlers
    $(document)
      .off("mousemove.actor-selector")
      .off("mouseup.actor-selector")
      .on("mousemove.actor-selector", (e) => this._onDocumentMouseMove(e as JQuery.MouseMoveEvent))
      .on("mouseup.actor-selector", (e) => this._onDocumentMouseUp(e as JQuery.MouseUpEvent));

    this._dragDrop.forEach(dd => dd.bind(html[0]));
  }

  override close(options?: Application.CloseOptions): Promise<void> {
    // Clean up document-level event listeners
    $(document)
      .off("mousemove.actor-selector")
      .off("mouseup.actor-selector");
    
    return super.close(options);
  }

  private async _onImportPortraits(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid') as string;
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
            await FilePicker.createDirectory('data', folder);
          } catch (err) {
            console.log(CONSTANTS.DEBUG_PREFIX, err);
          }
        }

        this.folders[uuid] = targetFolder;
      }

      for (const file of files) {
        await FilePicker.upload('data', targetFolder, file);
        console.log(`${CONSTANTS.DEBUG_PREFIX} Uploaded:`, file.name);
      }

      await updateActorConfig(uuid, targetFolder);
      ui.notifications?.info(`Successfully imported ${files.length} portraits`);
      this.render(false);
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
  private _onRowFileDragOver(event: JQuery.DragOverEvent): void {
    const types = event.originalEvent?.dataTransfer?.types;
    if (!types || !Array.from(types).includes("Files")) return;
    event.preventDefault();
    $(event.currentTarget).addClass("file-drop-target");
  }

  private _onRowFileDragLeave(event: JQuery.DragLeaveEvent): void {
    const row = event.currentTarget as HTMLElement;
    const related = (event.originalEvent as DragEvent | undefined)?.relatedTarget as Node | null;
    if (related && row.contains(related)) return;
    row.classList.remove("file-drop-target");
  }

  private _onDragHandleMouseDown(event: JQuery.MouseDownEvent): void {
    const item = (event.currentTarget as HTMLElement).closest<HTMLElement>(".selected-actor");
    if (!item) return;

    const rect = item.getBoundingClientRect();
    this.draggedItem = item;
    this.grabOffset = event.clientY - (rect.top + rect.height / 2);

    item.classList.add("dragging");
    event.preventDefault();
  }

  // group list whose folder spans the pointer's height
  private _groupListAt(y: number): HTMLElement | null {
    const sections = Array.from(this.element[0].querySelectorAll<HTMLElement>(".actor-group"));
    const section = sections.find(s => {
      const rect = s.getBoundingClientRect();
      return y >= rect.top && y <= rect.bottom;
    });
    return section?.querySelector<HTMLElement>(".group-actors") ?? null;
  }

  // rows slot in before the first sibling whose middle sits below the dragged row
  private _onDocumentMouseMove(event: JQuery.MouseMoveEvent): void {
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
  private _onDocumentMouseUp(_event: JQuery.MouseUpEvent): void {
    if (!this.draggedItem) return;

    this.draggedItem.style.transform = "";
    this.draggedItem.classList.remove("dragging");
    this.draggedItem = null;

    const lists = Array.from(this.element[0].querySelectorAll<HTMLElement>(".group-actors"));
    this.groups = lists.map(list => ({
      id: list.dataset.groupId ?? "",
      actors: Array.from(list.querySelectorAll<HTMLElement>(":scope > .selected-actor")).map(row => row.dataset.uuid!),
    }));
    this.render(false);
  }

  private _onNewGroup(event: JQuery.ClickEvent): void {
    event.preventDefault();
    this.groups.push({ id: foundry.utils.randomID(), actors: [] });
    this.render(false);
  }

  // actors fold into the group above, or below for the first one
  private _onRemoveGroup(event: JQuery.ClickEvent): void {
    event.preventDefault();
    const index = this.groups.findIndex(group => group.id === $(event.currentTarget).data("groupId"));
    if (index < 0 || this.groups.length < 2) return;

    const [removed] = this.groups.splice(index, 1);
    const into = this.groups[Math.max(0, index - 1)];
    if (index === 0) into.actors.unshift(...removed.actors);
    else into.actors.push(...removed.actors);
    this.render(false);
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
