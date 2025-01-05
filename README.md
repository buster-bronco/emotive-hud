# Emotive HUD

Emotive HUD is a [Foundry VTT](https://foundryvtt.com) module that brings stories to life with a dynamic character portrait interface. Lets players express their characters' emotions and reactions in real-time.

## Features

https://github.com/user-attachments/assets/79a3ee97-8370-482d-a1c0-9a730b339bc2

### Dynamic Portrait HUD

- Right-click on a character portrait in the HUD to open the expression picker
- Easily switch between different character portraits during gameplay

### Chat Integration

- Use `/say` to speak in character with your current portrait
- Use `/do` to describe actions with your current portrait
- Compatible with [Chat Commander](https://foundryvtt.com/packages/_chatcommands/)

### Flexible Layout

https://github.com/user-attachments/assets/8f14e97a-a714-47e9-a816-3315db785361

- Each player can customize their view with adjustable grid columns and choice of embedded chat or floating window display to match their screen setup
- Minimizable interface 

## Configuration

### Portrait Requirements

- Supported image formats: JPG, JPEG, PNG, WEBP
- All portraits for a character should be in the same folder
- Consistent image dimensions recommended for best results

### Setting Up the HUD

1. GMs can customize who shows up on the HUD at any time:
   - Click the menu icon (≡) in the Emotive HUD
   - Drag actors into the configuration window
   - Arrange actors in desired order using drag handles

2. Adding Character Portraits:
   **Option 1: Select Existing Folder**
   - Click the folder icon next to an actor
   - Navigate to and select a folder containing portrait images
   - Click Apply to save changes

   **Option 2: Batch Import Portraits**
   - Click the upload icon next to an actor to upload files directly
   - If no folder has specified, images will be automatically organized into: `/emotive-hud-portraits/[actor-name]/`
   - Existing files with the same names will be replaced

3. Click Apply to save changes. The HUD will update to show the selected actors with their portraits and cache them for player use.

### Basic Controls

- **Toggle HUD**: Click the chevron icon (▼/▲) to minimize/maximize the HUD
- **Reset Portrait**: Click "Reset to Default" in the expression picker to return to the default portrait

### Module Settings
- **Actor Limit (World)**: Maximum number of actors that can be added to the HUD (default: 15)
- **Grid Columns (Local)**: Number of columns in the portrait grid (default: 3)
- **HUD Layout (Local)**: Choose between `Embedded in Chat` or `Floating Window`
- **Portrait Height Ratio (World)**: Controls the height-to-width ratio of actor portraits. A ratio of 1 creates square portraits, while 2 makes portraits twice as tall as they are wide.

## Permissions

- **GM**: Full access to all features, including HUD configuration
- **Players**: Can change expressions for owned characters and use chat integration

## Technical Notes

- Portrait changes only affect the Emotive HUD display and `/say`/`/do` messages - they do not modify the actor's default portrait in the character sheet
- The module uses WebSocket communication to sync portrait changes across clients

## Development Setup

Install FoundryVTT locally, then create an `.env` file in the project root directory with your desired Foundry module path like this:

`FOUNDRY_VTT_PATH="path/to/your/foundry/data/modules/emotive-hud"`

This will allow you to use `npm run dev` to have a hot reloading development enviroment.

## Acknowledgments
Used Code Snippets From
- https://github.com/MemelyPepeartly/pf2e-typescript-content-pack-template
- https://github.com/Lazrius/FoundryVTT-Typescript-Module-Template
