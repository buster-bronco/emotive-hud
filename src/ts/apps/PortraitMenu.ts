export default class PortraitMenu {
  private isVertical: boolean = true;
  private isMinimized: boolean = false;

  constructor() {
    // TODO: Initialize menu state
  }

  toggleOrientation(): void {
    this.isVertical = !this.isVertical;
  }

  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
  }
}