import { CONSTANTS } from "../constants";

interface ActorWithFolder extends Actor {
  portraitFolder?: string;
  portraitPath?: string;
}

export default class EmotiveActorSelector extends Application {
  private selectedActors: ActorWithFolder[] = [];
  protected override _dragDrop: DragDrop[] = [];
  
  constructor(options = {}) {
    super(options);

    this._dragDrop = [
      new DragDrop({
        dragSelector: ".actor-item",
        dropSelector: ".drag-area",
        permissions: {
          // create arrow functions that match the expected signature
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
      
      if (data.type === "Actor" && data.uuid) {
        // Check if actor is already in the list
        if (!this.selectedActors.some(actor => actor.uuid === data.uuid)) {
          console.log(CONSTANTS.DEBUG_PREFIX, "Processing Actor drop with ID:", data.id);
          this.selectedActors.push({
            ...data,
            portraitFolder: "",
            portraitPath: ""
          });
          this.render(false);
        }
      }
    } catch (err) {
      console.error("Error processing drop:", err);
    }
  }

  private async _onSelectPortraitFolder(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    const actor = this.selectedActors.find(a => a.uuid === uuid);
    if (!actor) return;

    const fp = new FilePicker({
      type: "folder",
      callback: async (path: string) => {
        actor.portraitFolder = path;
        actor.portraitPath = path + "/*";
        this.render(false);
      },
      current: actor.portraitFolder || undefined
    });
    fp.browse("");
  }

  private async _onSelectPortraitPath(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    const actor = this.selectedActors.find(a => a.uuid === uuid);
    if (!actor) return;

    const fp = new FilePicker({
      type: "image",
      callback: async (path: string) => {
        // Extract folder path from the selected file
        const folderPath = path.substring(0, path.lastIndexOf('/'));
        actor.portraitFolder = folderPath;
        actor.portraitPath = folderPath + "/*";
        this.render(false);
      },
      current: actor.portraitPath?.replace("/*", "") || undefined
    });
    fp.browse("");
  }

  private _onRemoveActor(event: JQuery.ClickEvent): void {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    this.selectedActors = this.selectedActors.filter(actor => actor.uuid !== uuid);
    this.render(false);
  }

  override get title(): string {
    return (game as Game).i18n.localize("EMOTIVEHUD.emotive-actor-selector");
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "expressive-actor-select",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-actor-select.hbs`,
      width: 720,
      height: 720,
    }) as ApplicationOptions;
  }

  override async getData() {
    const enrichedActors = await Promise.all(
      this.selectedActors.map(async (actorRef) => {
        const actor = await fromUuid(actorRef.uuid) as Actor;
        return {
          ...actorRef,
          name: actor?.name,
          img: actor?.img,
          portraitFolder: actorRef.portraitFolder || "",
          portraitPath: actorRef.portraitPath || ""
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
    
    html.find(".refresh-button")
      .on("click", this._onClickRefreshButton.bind(this));
        
    html.find(".remove-actor")
      .on("click", this._onRemoveActor.bind(this));

    html.find(".select-portrait-folder")
      .on("click", this._onSelectPortraitFolder.bind(this));
      
    html.find(".actor-portrait.clickable")
      .on("click", this._onSelectPortraitPath.bind(this));

    this._dragDrop.forEach(dd => dd.bind(html[0]));
  }

  private _onClickRefreshButton(event: Event): void {
    event.preventDefault();
    this.render(false);
  }
}
