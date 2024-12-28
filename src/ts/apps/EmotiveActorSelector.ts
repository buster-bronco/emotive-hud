import { CONSTANTS } from "../constants";

export default class EmotiveActorSelector extends Application {
  private selectedActors: Actor[] = [];
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
      console.log("Checking if can drag start for selector:", selector);
      return true;
    }
    
    protected override _canDragDrop(selector: string | undefined): boolean {
      if (!selector) return false;
      console.log("Checking if can drop for selector:", selector);
      return true;
    }

    protected override _onDragStart(event: DragEvent): void {
        if (!event.dataTransfer) return;
        
        const target = event.currentTarget as HTMLElement;
        const actorId = target.dataset.actorId;
        
        console.log("Actor selected for drag:", actorId);
        
        event.dataTransfer.setData("text/plain", JSON.stringify({
            type: "Actor",
            id: actorId
        }));
    }

    protected _onDragDrop(event: DragEvent): void {
        if (!event.dataTransfer) return;
        
        try {
            const data = JSON.parse(event.dataTransfer.getData("text/plain"));
            console.log("Actor dropped:", data);
            
            if (data.type === "Actor" && data.id) {
                console.log("Processing actor drop with ID:", data.id);

                this.render(false); // Re-render to update the list
            }
        } catch (err) {
            console.error("Error processing drop:", err);
        }
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

  override getData() {
    return {
      selectedActors: this.selectedActors,
    };
  }

  override activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html);
    html
      .find(".refresh-button")
      .on("click", this._onClickRefreshButton.bind(this));

    // Bind the drag drop handlers
    this._dragDrop.forEach(dd => dd.bind(html[0]));
  }

  private _onClickRefreshButton(event: Event): void {
    event.preventDefault();
    // Implement refresh functionality here
  }
}
