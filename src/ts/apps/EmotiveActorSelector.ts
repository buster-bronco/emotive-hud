import { CONSTANTS } from "../constants";
import { getActorConfigs, getActorLimit, getHUDState, setHUDState, updateActorConfig } from "../settings";
import { ActorConfig } from '../types';
import { emitHUDRefresh } from "../sockets";
import { getGame, getModule } from "../utils";

export default class EmotiveActorSelector extends Application {
  private selectedActors: ActorConfig[] = [];
  protected override _dragDrop: DragDrop[] = [];
  private draggedItem: HTMLElement | null = null;
  private dragStartY: number = 0;
  private dropTargetIndex: number | null = null;
  
  constructor(options = {}) {
    super(options);

    // load up settings data
    this._loadFromSettings();

    this._dragDrop = [
      new DragDrop({
        dragSelector: ".actor-item",
        dropSelector: ".drag-area",
        permissions: {
          dragstart: (selector: string | undefined) => this._canDragStart(selector),
          drop: (selector: string | undefined) => this._canDragDrop(selector)
        },
        callbacks: {
          dragstart: this._onDragStart.bind(this),
          drop: this._onDragDrop.bind(this)
        }
      })
    ];
  }

  private async _loadFromSettings(): Promise<void> {
    const hudState = getHUDState();
    const configs = getActorConfigs();
    
    // Load actors in their correct order from HUD state
    this.selectedActors = hudState.actors
      .sort((a, b) => a.position - b.position)
      .map(({uuid}) => {
        const config = configs[uuid];
        return {
          uuid,
          portraitFolder: config?.portraitFolder || ""
        };
      });
  }

  protected override _canDragStart(selector: string | undefined): boolean {
    if (!selector) return false;
    return true;
  }
  
  protected override _canDragDrop(selector: string | undefined): boolean {
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

  protected _onDragDrop(event: DragEvent): void {
    if (!event.dataTransfer) return;
    
    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"));
      const actorLimit = getActorLimit();
      
      if (data.type === "Actor" && data.uuid) {
        // Check if we've hit the actor limit
        if (this.selectedActors.length >= actorLimit) {
          ui.notifications?.warn(`Cannot add more actors. Maximum limit of ${actorLimit} reached.`);
          return;
        }
        
        // Check if actor is already in the list
        if (!this.selectedActors.some(actor => actor.uuid === data.uuid)) {
          console.log(CONSTANTS.DEBUG_PREFIX, "Processing Actor drop with ID:", data.uuid);
  
          // Retrieve the existing config for the actor
          const configs = getActorConfigs();
          const actorConfig = configs[data.uuid];
  
          // Use the portraitFolder from config if it exists, or an empty string
          const portraitFolder = actorConfig?.portraitFolder || "";
  
          // Add actor to selectedActors with its existing portrait folder
          this.selectedActors.push({
            uuid: data.uuid,
            portraitFolder: portraitFolder
          });
  
          // Update settings and re-render
          this.render(false);
        }
      }
    } catch (err) {
      console.error(CONSTANTS.DEBUG_PREFIX, "Error processing drop:", err);
    }
  }

  private async _onSelectPortraitFolder(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    const actor = this.selectedActors.find(a => a.uuid === uuid);
    if (!actor) return;
  
    const fp = new FilePicker({
      type: "folder",
      allowUpload: true,
      displayMode: "images",
      callback: async (path: string) => {
        try {
          actor.portraitFolder = path;
          this.render(true);
        } catch (error) {
          console.error(CONSTANTS.DEBUG_PREFIX, 'Error setting portrait folder:', error);
          ui.notifications?.error("Failed to set portrait folder");
        }
      },
    });
    fp.browse( actor.portraitFolder || "");
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
    this.selectedActors = this.selectedActors.filter(actor => actor.uuid !== uuid);
    this.render(false);
  }

  override get title(): string {
    return getGame().i18n.localize("EMOTIVEHUD.emotive-actor-selector");
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "expressive-actor-select",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-actor-select.hbs`,
      width: 720,
      height: 720,
    }) as ApplicationOptions;
  }

  protected override _getHeaderButtons(): Application.HeaderButton[] {
    const buttons = super._getHeaderButtons();
    
    buttons.unshift({
      label: "Reset Changes",
      class: "reset-changes",
      icon: "fas fa-rotate-left",
      onclick: () => {
        const selector = getModule().emotiveActorSelector;
        selector._onResetChanges();
      }
    });
  
    return buttons;
  }
  
  private async _onResetChanges(): Promise<void> {
    await this._loadFromSettings();
    this.render(false);
  }

  override async getData() {
    const enrichedActors = await Promise.all(
      this.selectedActors.map(async (actorRef) => {
        const actor = await fromUuid(actorRef.uuid) as Actor;
        return {
          ...actorRef,
          name: actor?.name,
          img: actor?.img,
          portraitFolder: actorRef.portraitFolder || ""
        };
      })
    );

    console.log(CONSTANTS.DEBUG_PREFIX, "selectedActors:", enrichedActors);

    return {
      selectedActors: enrichedActors,
    };
  }

  override activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html);
    
    html.find(".apply-button")
      .on("click", this._onClickApplyButton.bind(this));
        
    html.find(".remove-actor")
      .on("click", this._onRemoveActor.bind(this));

    html.find(".select-portrait-folder")
      .on("click", this._onSelectPortraitFolder.bind(this));

    html.find
      (".import-portraits").on("click", this._onImportPortraits.bind(this));
      
    html.find(".actor-portrait.clickable")
      .on("click", this._onClickActorPortrait.bind(this));

    const dragHandles = html.find(".drag-handle");
    dragHandles.on("mousedown", this._onDragHandleMouseDown.bind(this));
    
    $(document)
      .on<'mousemove'>('mousemove', this._onDocumentMouseMove.bind(this))
      .on<'mouseup'>('mouseup', this._onDocumentMouseUp.bind(this));

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
    const uuid = $(event.currentTarget).data('uuid');
    const actor = this.selectedActors.find(a => a.uuid === uuid);
    if (!actor) return;
  
    // Get actor details
    const gameActor = await fromUuid(actor.uuid) as Actor;
    if (!gameActor) return;
  
    // Determine target folder path
    let targetFolder = actor.portraitFolder;
    if (!targetFolder) {
      const baseFolder = 'emotive-hud-portraits';
      const actorFolder = gameActor.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown_actor';
      
      // Create base folder if it doesn't exist
      try {
        await FilePicker.createDirectory('data', baseFolder);
      } catch (err) {
        console.log(CONSTANTS.DEBUG_PREFIX, err);
      }
  
      // Create actor folder if it doesn't exist
      targetFolder = `${baseFolder}/${actorFolder}`;
      try {
        await FilePicker.createDirectory('data', targetFolder);
      } catch (err) {
        console.log(CONSTANTS.DEBUG_PREFIX, err);
      }
  
      // Update the actor's folder path
      actor.portraitFolder = targetFolder;
    }
  
    // Create file input and handle upload
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.jpg,.jpeg,.png,.webp';
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files?.length) return;
      
      try {
        // Upload each file
        for (const file of Array.from(target.files)) {
          const response = await fetch(URL.createObjectURL(file));
          const blob = await response.blob();
          
          // Create file in Foundry VTT
          await FilePicker.upload('data', targetFolder, new File([blob], file.name));
          console.log(`${CONSTANTS.DEBUG_PREFIX} Uploaded:`, file.name);
        }
  
        // Update the actor config with new folder
        await updateActorConfig(actor.uuid, targetFolder);
        
        ui.notifications?.info(`Successfully imported ${target.files.length} portraits`);
        
        // Refresh the display
        this.render(false);
      } catch (error) {
        console.error(`${CONSTANTS.DEBUG_PREFIX} Error uploading files:`, error);
        ui.notifications?.error("Failed to upload one or more portraits");
      }
    };
  
    input.click();
  }

  private _onDragHandleMouseDown(event: JQuery.MouseDownEvent): void {
    const handle = event.currentTarget;
    const item = handle.closest(".selected-actor") as HTMLElement;
    if (!item) return;
  
    this.draggedItem = item;
    this.dragStartY = event.pageY;
    this.dropTargetIndex = null;  // Reset new index
    
    item.classList.add("dragging");
    event.preventDefault();
  }
  
  private _onDocumentMouseMove(event: JQuery.MouseMoveEvent): void {
    if (!this.draggedItem) return;
  
    const list = this.draggedItem.parentElement;
    if (!list) return;
  
    const items = Array.from(list.children) as HTMLElement[];
    const draggedIndex = items.indexOf(this.draggedItem);
    
    // Calculate mouse movement
    const mouseY = event.pageY;
    const deltaY = mouseY - this.dragStartY;
    
    // Update position of dragged item
    this.draggedItem.style.transform = `translateY(${deltaY}px)`;
    
    // Find new position
    const draggedRect = this.draggedItem.getBoundingClientRect();
    const draggedMiddle = draggedRect.top + draggedRect.height / 2;
    
    let potentialdropTargetIndex = draggedIndex;
    
    items.forEach((item, index) => {
      if (item === this.draggedItem) return;
      
      const rect = item.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      
      if (index < draggedIndex && draggedMiddle < middle) {
        potentialdropTargetIndex = index;
      } else if (index > draggedIndex && draggedMiddle > middle) {
        potentialdropTargetIndex = index;
      }
    });
    
    if (potentialdropTargetIndex !== draggedIndex) {
      if (potentialdropTargetIndex < draggedIndex) {
        list.insertBefore(this.draggedItem, items[potentialdropTargetIndex]);
      } else {
        list.insertBefore(this.draggedItem, items[potentialdropTargetIndex + 1]);
      }
      
      // Reset transform on other items
      items.forEach(item => {
        if (item !== this.draggedItem) {
          item.style.transform = "";
        }
      });
      
      this.dragStartY = mouseY;
      this.dropTargetIndex = potentialdropTargetIndex;  // Store the new index
    }
  }
  
  private _onDocumentMouseUp(_event: JQuery.MouseUpEvent): void {
    if (!this.draggedItem) return;
    
    if (this.dropTargetIndex !== null) {
      // Get all actor elements in their current DOM order
      const items = Array.from(this.draggedItem.parentElement?.children || []);
      
      // Rebuild selectedActors array based on current DOM order
      this.selectedActors = items.map(item => {
        const uuid = item.getAttribute('data-uuid');
        const existingConfig = this.selectedActors.find(actor => actor.uuid === uuid);
        return {
          uuid: uuid!,
          portraitFolder: existingConfig?.portraitFolder || ""
        };
      });
      
      console.log('Updated selectedActors after drag:', this.selectedActors);
    }
    
    this.draggedItem.style.transform = "";
    this.draggedItem.classList.remove("dragging");
    this.draggedItem = null;
    this.dragStartY = 0;
    this.dropTargetIndex = null;
  }

  private async _onClickApplyButton(event: Event): Promise<void> {
    event.preventDefault();
    
    try {
      // Update all actor configs in parallel
      const configUpdatePromises = this.selectedActors
        .map(actor => updateActorConfig(actor.uuid, actor.portraitFolder));
      
      // Wait for all updates to complete
      await Promise.all(configUpdatePromises);

      // Update HUD state with current actors and their positions
      const hudState = {
        actors: this.selectedActors.map((actor, index) => ({
          uuid: actor.uuid,
          position: index
        }))
      };
      
      // Save the new state
      await setHUDState(hudState);
      
      // Render the HUD with new changes
      getModule().emotiveHUD.render();
      
      // Emit refresh to other clients only after all updates are complete
      emitHUDRefresh();

      this.close();
      
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error saving changes:', error);
      ui.notifications?.error("Failed to save changes");
    }
  }
}
